import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sections, sessions, students } from "@/lib/db/schema";

const COOKIE = "frq_session";
const SESSION_DAYS = 45; // comfortably longer than a grading window

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and fill it in.");
  // A guessable secret lets anyone forge a teacher session, which is every
  // student's grades. Fail at the door rather than quietly accepting it.
  if (process.env.NODE_ENV === "production" && s.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production. Generate one with: openssl rand -base64 32");
  }
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Cookie carries `id.signature`, so a student can't hand-edit their way into the teacher console. */
function seal(id: string): string {
  return `${id}.${sign(id)}`;
}

function unseal(cookieValue: string): string | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1) return null;
  const id = cookieValue.slice(0, dot);
  const provided = Buffer.from(cookieValue.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? id : null;
}

export function newId(): string {
  return randomBytes(16).toString("hex");
}

async function createSession(role: "teacher" | "student", studentId?: string) {
  const id = newId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id, role, studentId: studentId ?? null, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, seal(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export type Viewer =
  | { role: "teacher" }
  | { role: "student"; student: typeof students.$inferSelect; section: typeof sections.$inferSelect };

export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const id = unseal(raw);
  if (!id) return null;

  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  if (row.role === "teacher") return { role: "teacher" };
  if (!row.studentId) return null;

  const student = await db.query.students.findFirst({ where: eq(students.id, row.studentId) });
  if (!student) return null;
  const section = await db.query.sections.findFirst({ where: eq(sections.id, student.sectionId) });
  if (!section) return null;

  return { role: "student", student, section };
}

export async function requireTeacher(): Promise<void> {
  const viewer = await getViewer();
  if (viewer?.role !== "teacher") throw new Error("UNAUTHORIZED");
}

export async function requireStudent() {
  const viewer = await getViewer();
  if (viewer?.role !== "student") throw new Error("UNAUTHORIZED");
  return viewer;
}

export async function signInTeacher(password: string): Promise<boolean> {
  const expected = process.env.TEACHER_PASSWORD;
  if (!expected) throw new Error("TEACHER_PASSWORD is not set.");
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await createSession("teacher");
  return true;
}

/**
 * Students identify themselves with a class code and their name off the
 * roster. No passwords, no Google, nothing a district can switch off the
 * morning of an assignment.
 */
export async function signInStudent(joinCode: string, studentId: string): Promise<boolean> {
  const section = await db.query.sections.findFirst({
    where: eq(sections.joinCode, normalizeJoinCode(joinCode)),
  });
  if (!section || section.archived) return false;

  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.sectionId, section.id)),
  });
  if (!student) return false;

  await createSession("student", student.id);
  return true;
}

export async function signOut() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const id = raw ? unseal(raw) : null;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  jar.delete(COOKIE);
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Ambiguous glyphs are omitted: a code read off a projector at the back of the
 * room shouldn't hinge on telling O from 0.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
