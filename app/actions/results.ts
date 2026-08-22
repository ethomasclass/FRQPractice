"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiFeedback,
  assignments,
  calibrationScores,
  finalMarks,
  responses,
  rubricCriteria,
  rubricParts,
} from "@/lib/db/schema";
import { requireStudent } from "@/lib/auth";

/**
 * What a student sees at the end: their score part by part, the feedback, and
 * how well they scored other people. Peers' raw comments are never shown --
 * the feedback is written from them, which keeps the instruction and removes
 * any route for one student to be unkind to another.
 */
export async function studentResults(assignmentId: string) {
  const { student } = await requireStudent();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment || assignment.sectionId !== student.sectionId || assignment.status !== "released") return null;

  const response = await db.query.responses.findFirst({
    where: and(eq(responses.assignmentId, assignmentId), eq(responses.studentId, student.id)),
  });
  if (!response?.submittedAt) return null;

  const parts = (await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) })).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const criteria = parts.length
    ? await db.query.rubricCriteria.findMany({ where: inArray(rubricCriteria.partId, parts.map((p) => p.id)) })
    : [];
  const marks = await db.query.finalMarks.findMany({ where: eq(finalMarks.responseId, response.id) });
  const feedback = await db.query.aiFeedback.findFirst({ where: eq(aiFeedback.responseId, response.id) });
  const calibration = (
    await db.query.calibrationScores.findMany({ where: eq(calibrationScores.assignmentId, assignmentId) })
  ).find((c) => c.reviewerId === student.id);

  return {
    title: assignment.title,
    isMakeup: response.isMakeup,
    responseText: response.text,
    outOf: parts.length,
    score: marks.filter((m) => m.earned).length,
    parts: parts.map((p) => ({
      label: p.label,
      taskVerb: p.taskVerb,
      promptText: p.promptText,
      earned: marks.find((m) => m.partId === p.id)?.earned ?? false,
      criteria: criteria
        .filter((c) => c.partId === p.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((c) => c.text),
    })),
    feedback: feedback?.body ?? "",
    calibration: calibration
      ? {
          pointsAgreed: calibration.pointsAgreed,
          pointsJudged: calibration.pointsJudged,
          reviewsCompleted: calibration.reviewsCompleted,
          reviewsAssigned: calibration.reviewsAssigned,
        }
      : null,
  };
}
