"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exemplars } from "@/lib/db/schema";
import { newId, requireTeacher } from "@/lib/auth";

/**
 * Released College Board material the teacher pastes in. Used as few-shot
 * style exemplars when drafting a rubric, and as the source for the scorer's
 * calibration set.
 *
 * Deliberately stored in the teacher's own database rather than the repo: this
 * material is copyrighted, and classroom use is fine while republishing is not.
 */
export async function listExemplars() {
  await requireTeacher();
  const rows = await db.query.exemplars.findMany({ orderBy: [desc(exemplars.createdAt)] });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    year: r.year,
    length: r.body.length,
    preview: r.body.slice(0, 180),
  }));
}

export async function createExemplar(_prev: unknown, formData: FormData) {
  await requireTeacher();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const kind = String(formData.get("kind") ?? "scoring_guideline") as
    | "frq"
    | "scoring_guideline"
    | "chief_reader";
  const yearRaw = String(formData.get("year") ?? "").trim();

  if (!title) return { error: "Give it a name so you can recognize it later." };
  if (body.length < 200) {
    return { error: "That looks too short to be useful. Paste the whole scoring guideline for the question." };
  }

  await db.insert(exemplars).values({
    id: newId(),
    title,
    kind,
    year: yearRaw ? Number(yearRaw) : null,
    body,
  });

  revalidatePath("/teacher/exemplars");
  return { ok: true as const };
}

export async function deleteExemplar(id: string) {
  await requireTeacher();
  await db.delete(exemplars).where(eq(exemplars.id, id));
  revalidatePath("/teacher/exemplars");
  return { ok: true as const };
}
