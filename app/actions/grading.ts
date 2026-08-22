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

/** How much scoring and feedback work is outstanding. Drives the progress UI. */
export async function gradingProgress(assignmentId: string) {
  await requireTeacher();

  const submitted = (
    await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })
  ).filter((r) => r.submittedAt);
  if (submitted.length === 0) return { total: 0, scored: 0, feedbackWritten: 0 };

  const ids = submitted.map((r) => r.id);
  const parts = await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) });
  const marks = await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, ids) });
  const feedback = await db.query.aiFeedback.findMany({ where: inArray(aiFeedback.responseId, ids) });

  const scoredIds = new Set(
    ids.filter((id) => marks.filter((m) => m.responseId === id).length >= parts.length),
  );

  return { total: submitted.length, scored: scoredIds.size, feedbackWritten: feedback.length };
}

/**
 * Scores ONE unscored response and reports what is left.
 *
 * Deliberately one at a time. Scoring fifty responses takes fifteen minutes or
 * more, and every serverless host kills a request long before that — a loop
 * over the whole class works locally and then times out in production, which
 * is the worst place to discover it. The caller drives the loop, so each
 * invocation is a few seconds, progress is visible, and a failure costs one
 * response instead of the batch.
 */
export async function scoreNextResponse(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const parts = await rubricFor(assignmentId);
  if (parts.length === 0) return { error: "This assignment has no rubric yet.", done: true as const };

  const submitted = (
    await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })
  ).filter((r) => r.submittedAt);
  const scoredAlready = submitted.length
    ? await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, submitted.map((r) => r.id)) })
    : [];

  const next = submitted.find(
    (r) => scoredAlready.filter((m) => m.responseId === r.id).length < parts.length,
  );
  if (!next) return { ok: true as const, done: true as const, remaining: 0 };

  // Clear a partial write from an earlier interrupted attempt before retrying.
  await db.delete(aiMarks).where(eq(aiMarks.responseId, next.id));

  try {
    const { parts: results } = await scoreResponse({
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
      responseText: next.text,
    });

    await db.insert(aiMarks).values(
      results.map((r, i) => ({
        id: newId(),
        responseId: next.id,
        partId: parts[i].id,
        earned: r.earned,
        criterionCode: r.criterionCode,
        quote: r.quote,
        justification: r.justification,
        confidence: r.confidence,
        model: SCORING_MODEL,
      })),
    );
  } catch (err) {
    // Report and stop, rather than spinning the caller on a failing response.
    return {
      error: err instanceof Error ? err.message : String(err),
      done: true as const,
    };
  }

  const progress = await gradingProgress(assignmentId);
  return { ok: true as const, done: false as const, remaining: progress.total - progress.scored };
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
        ai: ai ? { earned: ai.earned, confidence: ai.confidence, model: ai.model } : null,
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
        ai: ai ? { earned: ai.earned, confidence: ai.confidence, model: ai.model } : null,
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

/**
 * Writes feedback for ONE response and reports what is left.
 *
 * Same reason as scoring: fifty feedback calls will not survive a serverless
 * request timeout, so the caller drives the loop.
 */
export async function writeNextFeedback(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const parts = await rubricFor(assignmentId);
  const rows = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  if (rows.length === 0) return { ok: true as const, done: true as const, remaining: 0 };

  const responseIds = rows.map((r) => r.id);
  const existing = await db.query.aiFeedback.findMany({ where: inArray(aiFeedback.responseId, responseIds) });
  const written = new Set(existing.map((f) => f.responseId));

  const next = rows.find((r) => !written.has(r.id));
  if (!next) return { ok: true as const, done: true as const, remaining: 0 };

  const settled = await db.query.finalMarks.findMany({ where: eq(finalMarks.responseId, next.id) });
  const ai = await db.query.aiMarks.findMany({ where: eq(aiMarks.responseId, next.id) });
  const teacher = await db.query.teacherMarks.findMany({ where: eq(teacherMarks.responseId, next.id) });
  const reviewsHere = (
    await db.query.reviewAssignments.findMany({ where: eq(reviewAssignments.responseId, next.id) })
  ).filter((r) => r.completedAt);
  const peers = reviewsHere.length
    ? await db.query.peerMarks.findMany({
        where: inArray(peerMarks.reviewAssignmentId, reviewsHere.map((r) => r.id)),
      })
    : [];
  const student = await db.query.students.findFirst({ where: eq(students.id, next.studentId) });

  try {
    const body = await writeFeedback({
      studentFirstName: student?.name.split(" ")[0] ?? "there",
      title: assignment.title,
      responseText: next.text,
      parts: parts.map((part) => {
        const final = settled.find((f) => f.partId === part.id);
        const aiMark = ai.find((m) => m.partId === part.id);
        const teacherMark = teacher.find((m) => m.partId === part.id);
        const peersHere = peers.filter((m) => m.partId === part.id);
        return {
          label: part.label,
          taskVerb: part.taskVerb,
          promptText: part.promptText,
          earned: final?.earned ?? false,
          aiJustification: aiMark?.justification ?? "",
          peerHighlights: peersHere.filter((m) => m.earned && m.highlightText).map((m) => m.highlightText),
          peerReasons: peersHere
            .filter((m) => !m.earned)
            .map((m) => [m.reason ? REASON_LABELS[m.reason] : "", m.comment].filter(Boolean).join(" — "))
            .filter(Boolean),
          teacherNote: teacherMark?.note ?? "",
          criteria: part.criteria.map((c) => ({ code: c.code, text: c.text })),
        };
      }),
    });

    await db.insert(aiFeedback).values({ id: newId(), responseId: next.id, body, model: SCORING_MODEL });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), done: true as const };
  }

  return { ok: true as const, done: false as const, remaining: rows.length - written.size - 1 };
}

/**
 * Opens results to students.
 *
 * Feedback is written beforehand, one response per call. Releasing without it
 * is allowed on purpose — a key that ran out mid-batch should not keep a class
 * from seeing scores their classmates already earned.
 */
export async function releaseAssignment(assignmentId: string) {
  await requireTeacher();

  const rows = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  if (rows.length === 0) return { error: "Nothing to release." };

  await settleAssignment(assignmentId);

  await db
    .update(responses)
    .set({ releasedAt: new Date() })
    .where(inArray(responses.id, rows.map((r) => r.id)));
  await db.update(assignments).set({ status: "released" }).where(eq(assignments.id, assignmentId));

  revalidatePath("/teacher");
  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const, released: rows.length };
}
