"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assignments, responses, rubricParts } from "@/lib/db/schema";
import { newId, requireStudent } from "@/lib/auth";
import { remainingMs } from "@/lib/time";

/**
 * Opens (or resumes) a student's response and starts the clock the first time.
 * The clock start is written server-side and never trusted from the client.
 */
export async function openResponse(assignmentId: string) {
  const { student } = await requireStudent();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment || assignment.sectionId !== student.sectionId) throw new Error("NOT_FOUND");

  let response = await db.query.responses.findFirst({
    where: and(eq(responses.assignmentId, assignmentId), eq(responses.studentId, student.id)),
  });

  if (!response) {
    const id = newId();
    // Anything written after the review window opened is makeup work: it gets
    // scored by the AI alone, because there are no peers left to review it.
    const isMakeup = assignment.status !== "writing";
    await db.insert(responses).values({ id, assignmentId, studentId: student.id, startedAt: new Date(), isMakeup });
    response = await db.query.responses.findFirst({ where: eq(responses.id, id) });
  } else if (!response.startedAt) {
    await db.update(responses).set({ startedAt: new Date() }).where(eq(responses.id, response.id));
    response = await db.query.responses.findFirst({ where: eq(responses.id, response.id) });
  }

  return response!;
}

export type SaveResult =
  | { ok: true; remainingMs: number | null; submitted: false }
  | { ok: true; remainingMs: 0; submitted: true; reason: "time" };

/**
 * Autosave. Also the enforcement point for the clock: if time ran out while the
 * student was typing (or while their laptop was shut), this call submits the
 * work rather than discarding it.
 */
export async function saveDraft(responseId: string, text: string): Promise<SaveResult> {
  const { student } = await requireStudent();

  const response = await db.query.responses.findFirst({ where: eq(responses.id, responseId) });
  if (!response || response.studentId !== student.id) throw new Error("NOT_FOUND");
  if (response.submittedAt) throw new Error("ALREADY_SUBMITTED");

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, response.assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const left = remainingMs({ startedAt: response.startedAt, timeLimitMinutes: assignment.timeLimitMinutes });

  if (left !== null && left <= 0) {
    // Save what they had, then close it. Losing the last sentence to a timer is
    // the kind of thing students remember for the rest of the year.
    await db
      .update(responses)
      .set({ text, submittedAt: new Date(), autoSubmitted: true })
      .where(eq(responses.id, responseId));
    return { ok: true, remainingMs: 0, submitted: true, reason: "time" };
  }

  await db.update(responses).set({ text }).where(eq(responses.id, responseId));
  return { ok: true, remainingMs: left, submitted: false };
}

export async function submitResponse(responseId: string, text: string) {
  const { student } = await requireStudent();

  const response = await db.query.responses.findFirst({ where: eq(responses.id, responseId) });
  if (!response || response.studentId !== student.id) throw new Error("NOT_FOUND");
  if (response.submittedAt) return { ok: true as const };

  await db.update(responses).set({ text, submittedAt: new Date() }).where(eq(responses.id, responseId));
  revalidatePath("/student");
  return { ok: true as const };
}

export async function partsForAssignment(assignmentId: string) {
  const parts = await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) });
  return parts.sort((a, b) => a.orderIndex - b.orderIndex);
}
