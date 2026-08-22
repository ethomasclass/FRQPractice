"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sections, students } from "@/lib/db/schema";
import { normalizeJoinCode, signInStudent, signInTeacher, signOut } from "@/lib/auth";

export type ActionState = { error?: string };

export async function lookupSectionAction(_prev: unknown, formData: FormData) {
  const code = normalizeJoinCode(String(formData.get("joinCode") ?? ""));
  if (!code) return { error: "Enter the class code your teacher gave you." };

  const section = await db.query.sections.findFirst({ where: eq(sections.joinCode, code) });
  if (!section || section.archived) return { error: "That class code doesn't match a class. Check with your teacher." };

  redirect(`/join/${section.joinCode}`);
}

export async function studentSignInAction(_prev: unknown, formData: FormData) {
  const joinCode = String(formData.get("joinCode") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return { error: "Choose your name from the list." };

  const ok = await signInStudent(joinCode, studentId);
  if (!ok) return { error: "That didn't work. Check the class code and try again." };

  redirect("/student");
}

export async function teacherSignInAction(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter your password." };

  const ok = await signInTeacher(password);
  if (!ok) return { error: "Wrong password." };

  redirect("/teacher");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function rosterForJoinCode(joinCode: string) {
  const section = await db.query.sections.findFirst({
    where: eq(sections.joinCode, normalizeJoinCode(joinCode)),
  });
  if (!section || section.archived) return null;

  const roster = await db.query.students.findMany({
    where: eq(students.sectionId, section.id),
  });
  roster.sort((a, b) => a.name.localeCompare(b.name));
  return { section, roster };
}
