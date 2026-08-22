"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  assignments,
  peerMarks,
  responses,
  reviewAssignments,
  rubricCriteria,
  rubricParts,
  type NotEarnedReason,
} from "@/lib/db/schema";
import { newId, requireStudent } from "@/lib/auth";

/** The next unfinished review in this student's queue, or null when they're done. */
export async function nextReviewId(assignmentId: string): Promise<string | null> {
  const { student } = await requireStudent();

  const mine = await db.query.reviewAssignments.findMany({ where: eq(reviewAssignments.reviewerId, student.id) });
  if (mine.length === 0) return null;

  const targets = await db.query.responses.findMany({
    where: inArray(responses.id, mine.map((m) => m.responseId)),
  });
  const inThisAssignment = new Set(targets.filter((t) => t.assignmentId === assignmentId).map((t) => t.id));

  const pending = mine
    .filter((m) => inThisAssignment.has(m.responseId) && !m.completedAt)
    .sort((a, b) => a.displayIndex - b.displayIndex);

  return pending[0]?.id ?? null;
}

export async function loadReview(reviewId: string) {
  const { student } = await requireStudent();

  const review = await db.query.reviewAssignments.findFirst({ where: eq(reviewAssignments.id, reviewId) });
  if (!review || review.reviewerId !== student.id) throw new Error("NOT_FOUND");

  const response = await db.query.responses.findFirst({ where: eq(responses.id, review.responseId) });
  if (!response) throw new Error("NOT_FOUND");

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, response.assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const parts = (await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignment.id) })).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const criteria = parts.length
    ? await db.query.rubricCriteria.findMany({ where: inArray(rubricCriteria.partId, parts.map((p) => p.id)) })
    : [];
  const existing = await db.query.peerMarks.findMany({ where: eq(peerMarks.reviewAssignmentId, reviewId) });

  const totalInQueue = (await db.query.reviewAssignments.findMany({ where: eq(reviewAssignments.reviewerId, student.id) }))
    .filter((r) => r.responseId !== review.responseId || true).length;

  return {
    review: { id: review.id, displayIndex: review.displayIndex, completedAt: review.completedAt },
    queueTotal: totalInQueue,
    assignment: { id: assignment.id, title: assignment.title, intro: assignment.intro },
    // The reviewer never learns whose work this is.
    responseText: response.text,
    parts: parts.map((p) => ({
      id: p.id,
      label: p.label,
      taskVerb: p.taskVerb,
      promptText: p.promptText,
      graderNote: p.graderNote,
      criteria: criteria
        .filter((c) => c.partId === p.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((c) => ({ code: c.code, text: c.text })),
    })),
    marks: existing.map((m) => ({
      partId: m.partId,
      earned: m.earned,
      highlightStart: m.highlightStart,
      highlightEnd: m.highlightEnd,
      highlightText: m.highlightText,
      criterionCode: m.criterionCode,
      reason: m.reason,
      comment: m.comment,
    })),
  };
}

export type MarkInput = {
  reviewId: string;
  partId: string;
  earned: boolean;
  highlightStart: number | null;
  highlightEnd: number | null;
  highlightText: string;
  criterionCode: string;
  reason: NotEarnedReason | null;
  comment: string;
};

export async function saveMark(input: MarkInput) {
  const { student } = await requireStudent();

  const review = await db.query.reviewAssignments.findFirst({ where: eq(reviewAssignments.id, input.reviewId) });
  if (!review || review.reviewerId !== student.id) throw new Error("NOT_FOUND");
  if (review.completedAt) throw new Error("ALREADY_COMPLETE");

  const existing = await db.query.peerMarks.findFirst({
    where: and(eq(peerMarks.reviewAssignmentId, input.reviewId), eq(peerMarks.partId, input.partId)),
  });

  const values = {
    earned: input.earned,
    highlightStart: input.highlightStart,
    highlightEnd: input.highlightEnd,
    highlightText: input.highlightText.slice(0, 2000),
    criterionCode: input.criterionCode,
    reason: input.earned ? null : input.reason,
    comment: input.comment.slice(0, 2000),
  };

  if (existing) {
    await db.update(peerMarks).set(values).where(eq(peerMarks.id, existing.id));
  } else {
    await db.insert(peerMarks).values({
      id: newId(),
      reviewAssignmentId: input.reviewId,
      partId: input.partId,
      ...values,
    });
  }

  return { ok: true as const };
}

/** Called once every part has a mark. */
export async function completeReview(reviewId: string) {
  const { student } = await requireStudent();

  const review = await db.query.reviewAssignments.findFirst({ where: eq(reviewAssignments.id, reviewId) });
  if (!review || review.reviewerId !== student.id) throw new Error("NOT_FOUND");
  if (review.completedAt) return { ok: true as const };

  const response = await db.query.responses.findFirst({ where: eq(responses.id, review.responseId) });
  if (!response) throw new Error("NOT_FOUND");

  const parts = await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, response.assignmentId) });
  const marks = await db.query.peerMarks.findMany({ where: eq(peerMarks.reviewAssignmentId, reviewId) });

  if (marks.length < parts.length) throw new Error("INCOMPLETE");

  await db.update(reviewAssignments).set({ completedAt: new Date() }).where(eq(reviewAssignments.id, reviewId));
  revalidatePath("/student");
  return { ok: true as const };
}
