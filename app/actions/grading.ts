"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  aiFeedback,
  aiMarks,
  assignments,
  calibrationScores,
  finalMarks,
  peerMarks,
  responses,
  reviewAssignments,
  rubricCriteria,
  rubricParts,
  students,
  teacherMarks,
} from "@/lib/db/schema";
import { newId, requireTeacher } from "@/lib/auth";
import { computeCalibration, settleMark, yardstickFor } from "@/lib/scoring";
import { scoreResponse } from "@/lib/ai/score";
import { writeFeedback } from "@/lib/ai/feedback";
import { SCORING_MODEL } from "@/lib/ai/client";
import { REASON_LABELS } from "@/lib/labels";

async function rubricFor(assignmentId: string) {
  const parts = (await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) })).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const criteria = parts.length
    ? await db.query.rubricCriteria.findMany({ where: inArray(rubricCriteria.partId, parts.map((p) => p.id)) })
    : [];
  return parts.map((p) => ({
    ...p,
    criteria: criteria.filter((c) => c.partId === p.id).sort((a, b) => a.orderIndex - b.orderIndex),
  }));
}

/**
 * Scores every submitted response the AI hasn't seen yet.
 *
 * Runs before any peer votes are looked at, and skips responses already
 * scored, so re-running after a few makeups is cheap and doesn't churn marks
 * a teacher may have already overridden.
 */
export async function scoreAssignment(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const parts = await rubricFor(assignmentId);
  if (parts.length === 0) return { error: "This assignment has no rubric yet." };

  const submitted = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  const alreadyScored = submitted.length
    ? await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, submitted.map((r) => r.id)) })
    : [];
  const scoredIds = new Set(alreadyScored.map((m) => m.responseId));
  const todo = submitted.filter((r) => !scoredIds.has(r.id));

  let scored = 0;
  const failures: string[] = [];

  for (const response of todo) {
    try {
      const results = await scoreResponse({
        intro: assignment.intro,
        stimulusText: assignment.stimulusText,
        parts: parts.map((p) => ({
          id: p.id,
          label: p.label,
          taskVerb: p.taskVerb,
          promptText: p.promptText,
          graderNote: p.graderNote,
          criteria: p.criteria.map((c) => ({ code: c.code, text: c.text })),
        })),
        responseText: response.text,
      });

      await db.insert(aiMarks).values(
        results.map((r, i) => ({
          id: newId(),
          responseId: response.id,
          partId: parts[i].id,
          earned: r.earned,
          criterionCode: r.criterionCode,
          quote: r.quote,
          justification: r.justification,
          confidence: r.confidence,
          model: SCORING_MODEL,
        })),
      );
      scored += 1;
    } catch (err) {
      // One bad response must not abandon the other forty-nine.
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const, scored, skipped: submitted.length - todo.length, failures };
}

/** Recomputes settled marks and reviewer calibration for the whole assignment. */
export async function settleAssignment(assignmentId: string) {
  await requireTeacher();

  const parts = await rubricFor(assignmentId);
  const partIds = parts.map((p) => p.id);
  const rows = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  if (rows.length === 0 || partIds.length === 0) return { ok: true as const, settled: 0 };

  const responseIds = rows.map((r) => r.id);
  const reviews = await db.query.reviewAssignments.findMany({ where: inArray(reviewAssignments.responseId, responseIds) });
  const completedReviews = reviews.filter((r) => r.completedAt);
  const allPeerMarks = completedReviews.length
    ? await db.query.peerMarks.findMany({
        where: inArray(peerMarks.reviewAssignmentId, completedReviews.map((r) => r.id)),
      })
    : [];
  const allAiMarks = await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, responseIds) });
  const allTeacherMarks = await db.query.teacherMarks.findMany({ where: inArray(teacherMarks.responseId, responseIds) });

  const reviewById = new Map(completedReviews.map((r) => [r.id, r]));

  await db.delete(finalMarks).where(inArray(finalMarks.responseId, responseIds));

  const settledRows: (typeof finalMarks.$inferInsert)[] = [];
  // reviewerId -> the judgments they made, for calibration
  const judgementsByReviewer = new Map<string, { earned: boolean; yardstick: { earned: boolean } | null }[]>();

  for (const response of rows) {
    const reviewsHere = completedReviews.filter((r) => r.responseId === response.id);

    for (const part of parts) {
      const peersHere = allPeerMarks.filter(
        (m) => m.partId === part.id && reviewsHere.some((r) => r.id === m.reviewAssignmentId),
      );
      const ai = allAiMarks.find((m) => m.responseId === response.id && m.partId === part.id) ?? null;
      const teacher = allTeacherMarks.find((m) => m.responseId === response.id && m.partId === part.id) ?? null;

      const settled = settleMark({
        peers: peersHere.map((m) => ({
          reviewerId: reviewById.get(m.reviewAssignmentId)!.reviewerId,
          earned: m.earned,
        })),
        ai: ai ? { earned: ai.earned } : null,
        teacher: teacher ? { earned: teacher.earned } : null,
      });

      settledRows.push({
        id: newId(),
        responseId: response.id,
        partId: part.id,
        earned: settled.earned,
        source: settled.source,
        contested: settled.contested,
        peerEarnedCount: settled.peerEarnedCount,
        peerTotalCount: settled.peerTotalCount,
      });

      // Reviewers are measured against the independent read, not the outcome.
      const yardstick = yardstickFor({
        ai: ai ? { earned: ai.earned } : null,
        teacher: teacher ? { earned: teacher.earned } : null,
      });
      for (const mark of peersHere) {
        const reviewerId = reviewById.get(mark.reviewAssignmentId)!.reviewerId;
        const list = judgementsByReviewer.get(reviewerId) ?? [];
        list.push({ earned: mark.earned, yardstick });
        judgementsByReviewer.set(reviewerId, list);
      }
    }
  }

  if (settledRows.length) await db.insert(finalMarks).values(settledRows);

  // Calibration covers everyone who was given reviews, including those who
  // skipped them — a blank row is the signal the teacher needs.
  const reviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
  await db.delete(calibrationScores).where(eq(calibrationScores.assignmentId, assignmentId));

  if (reviewerIds.length) {
    await db.insert(calibrationScores).values(
      reviewerIds.map((reviewerId) => {
        const assigned = reviews.filter((r) => r.reviewerId === reviewerId);
        const result = computeCalibration({
          reviewerId,
          judgements: judgementsByReviewer.get(reviewerId) ?? [],
          reviewsAssigned: assigned.length,
          reviewsCompleted: assigned.filter((r) => r.completedAt).length,
        });
        return {
          id: newId(),
          assignmentId,
          reviewerId,
          pointsAgreed: result.pointsAgreed,
          pointsJudged: result.pointsJudged,
          reviewsAssigned: result.reviewsAssigned,
          reviewsCompleted: result.reviewsCompleted,
        };
      }),
    );
  }

  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const, settled: settledRows.length };
}

/** The teacher's ruling on one point. Re-settles so calibration follows it. */
export async function overrideMark(args: {
  assignmentId: string;
  responseId: string;
  partId: string;
  earned: boolean;
  note?: string;
}) {
  await requireTeacher();

  const existing = await db.query.teacherMarks.findFirst({
    where: eq(teacherMarks.responseId, args.responseId),
  });
  const match =
    existing && existing.partId === args.partId
      ? existing
      : (await db.query.teacherMarks.findMany({ where: eq(teacherMarks.responseId, args.responseId) })).find(
          (m) => m.partId === args.partId,
        );

  if (match) {
    await db
      .update(teacherMarks)
      .set({ earned: args.earned, note: args.note ?? match.note })
      .where(eq(teacherMarks.id, match.id));
  } else {
    await db.insert(teacherMarks).values({
      id: newId(),
      responseId: args.responseId,
      partId: args.partId,
      earned: args.earned,
      note: args.note ?? "",
    });
  }

  await settleAssignment(args.assignmentId);
  return { ok: true as const };
}

export async function clearOverride(assignmentId: string, responseId: string, partId: string) {
  await requireTeacher();
  const rows = await db.query.teacherMarks.findMany({ where: eq(teacherMarks.responseId, responseId) });
  const match = rows.find((m) => m.partId === partId);
  if (match) await db.delete(teacherMarks).where(eq(teacherMarks.id, match.id));
  await settleAssignment(assignmentId);
  return { ok: true as const };
}

/** Writes feedback for everyone, then opens results to students. */
export async function releaseAssignment(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  await settleAssignment(assignmentId);

  const parts = await rubricFor(assignmentId);
  const rows = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  if (rows.length === 0) return { error: "Nothing to release." };

  const responseIds = rows.map((r) => r.id);
  const settled = await db.query.finalMarks.findMany({ where: inArray(finalMarks.responseId, responseIds) });
  const allAi = await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, responseIds) });
  const allTeacher = await db.query.teacherMarks.findMany({ where: inArray(teacherMarks.responseId, responseIds) });
  const reviews = await db.query.reviewAssignments.findMany({ where: inArray(reviewAssignments.responseId, responseIds) });
  const completed = reviews.filter((r) => r.completedAt);
  const allPeer = completed.length
    ? await db.query.peerMarks.findMany({ where: inArray(peerMarks.reviewAssignmentId, completed.map((r) => r.id)) })
    : [];
  const roster = await db.query.students.findMany({ where: inArray(students.id, rows.map((r) => r.studentId)) });
  const existingFeedback = await db.query.aiFeedback.findMany({ where: inArray(aiFeedback.responseId, responseIds) });
  const hasFeedback = new Set(existingFeedback.map((f) => f.responseId));

  let written = 0;
  const failures: string[] = [];

  for (const response of rows) {
    if (hasFeedback.has(response.id)) continue;
    const student = roster.find((s) => s.id === response.studentId);
    const reviewsHere = completed.filter((r) => r.responseId === response.id);

    try {
      const body = await writeFeedback({
        studentFirstName: student?.name.split(" ")[0] ?? "there",
        title: assignment.title,
        responseText: response.text,
        parts: parts.map((part) => {
          const final = settled.find((f) => f.responseId === response.id && f.partId === part.id);
          const ai = allAi.find((m) => m.responseId === response.id && m.partId === part.id);
          const teacher = allTeacher.find((m) => m.responseId === response.id && m.partId === part.id);
          const peersHere = allPeer.filter(
            (m) => m.partId === part.id && reviewsHere.some((r) => r.id === m.reviewAssignmentId),
          );
          return {
            label: part.label,
            taskVerb: part.taskVerb,
            promptText: part.promptText,
            earned: final?.earned ?? false,
            aiJustification: ai?.justification ?? "",
            peerHighlights: peersHere.filter((m) => m.earned && m.highlightText).map((m) => m.highlightText),
            peerReasons: peersHere
              .filter((m) => !m.earned)
              .map((m) => [m.reason ? REASON_LABELS[m.reason] : "", m.comment].filter(Boolean).join(" — "))
              .filter(Boolean),
            teacherNote: teacher?.note ?? "",
            criteria: part.criteria.map((c) => ({ code: c.code, text: c.text })),
          };
        }),
      });

      await db.insert(aiFeedback).values({ id: newId(), responseId: response.id, body, model: SCORING_MODEL });
      written += 1;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  const now = new Date();
  await db.update(responses).set({ releasedAt: now }).where(inArray(responses.id, responseIds));
  await db.update(assignments).set({ status: "released" }).where(eq(assignments.id, assignmentId));

  revalidatePath("/teacher");
  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const, written, failures };
}
