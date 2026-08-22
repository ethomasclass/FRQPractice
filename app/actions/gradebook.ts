"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
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
import { requireTeacher } from "@/lib/auth";
import type { NotEarnedReason } from "@/lib/db/schema";

export type GradeRow = {
  responseId: string;
  studentId: string;
  studentName: string;
  isMakeup: boolean;
  score: number;
  contestedCount: number;
  points: {
    partId: string;
    label: string;
    taskVerb: string;
    promptText: string;
    criteria: { code: string; text: string }[];
    earned: boolean;
    source: string;
    contested: boolean;
    peerEarnedCount: number;
    peerTotalCount: number;
    ai: { earned: boolean; criterionCode: string; quote: string; justification: string; confidence: number } | null;
    teacher: { earned: boolean; note: string } | null;
    peers: { earned: boolean; highlightText: string; criterionCode: string; reason: NotEarnedReason | null; comment: string }[];
  }[];
  responseText: string;
};

/** Everything the grading screen needs, sorted so contested work floats up. */
export async function gradeView(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) return null;

  const parts = (await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) })).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const criteria = parts.length
    ? await db.query.rubricCriteria.findMany({ where: inArray(rubricCriteria.partId, parts.map((p) => p.id)) })
    : [];

  const rows = (await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })).filter(
    (r) => r.submittedAt,
  );
  if (rows.length === 0) return { assignment, parts, rows: [] as GradeRow[], calibration: [] };

  const responseIds = rows.map((r) => r.id);
  const roster = await db.query.students.findMany({ where: inArray(students.id, rows.map((r) => r.studentId)) });
  const settled = await db.query.finalMarks.findMany({ where: inArray(finalMarks.responseId, responseIds) });
  const ai = await db.query.aiMarks.findMany({ where: inArray(aiMarks.responseId, responseIds) });
  const teacher = await db.query.teacherMarks.findMany({ where: inArray(teacherMarks.responseId, responseIds) });
  const reviews = await db.query.reviewAssignments.findMany({ where: inArray(reviewAssignments.responseId, responseIds) });
  const completed = reviews.filter((r) => r.completedAt);
  const peers = completed.length
    ? await db.query.peerMarks.findMany({ where: inArray(peerMarks.reviewAssignmentId, completed.map((r) => r.id)) })
    : [];

  const calibrationRows = await db.query.calibrationScores.findMany({
    where: eq(calibrationScores.assignmentId, assignmentId),
  });
  const allStudents = await db.query.students.findMany({ where: eq(students.sectionId, assignment.sectionId) });
  const nameOf = new Map(allStudents.map((s) => [s.id, s.name]));

  const gradeRows: GradeRow[] = rows.map((response) => {
    const reviewsHere = completed.filter((r) => r.responseId === response.id);
    const points = parts.map((part) => {
      const final = settled.find((f) => f.responseId === response.id && f.partId === part.id);
      const aiMark = ai.find((m) => m.responseId === response.id && m.partId === part.id);
      const teacherMark = teacher.find((m) => m.responseId === response.id && m.partId === part.id);
      return {
        partId: part.id,
        label: part.label,
        taskVerb: part.taskVerb,
        promptText: part.promptText,
        criteria: criteria
          .filter((c) => c.partId === part.id)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((c) => ({ code: c.code, text: c.text })),
        earned: final?.earned ?? false,
        source: final?.source ?? "ai_only",
        contested: final?.contested ?? false,
        peerEarnedCount: final?.peerEarnedCount ?? 0,
        peerTotalCount: final?.peerTotalCount ?? 0,
        ai: aiMark
          ? {
              earned: aiMark.earned,
              criterionCode: aiMark.criterionCode,
              quote: aiMark.quote,
              justification: aiMark.justification,
              confidence: aiMark.confidence,
            }
          : null,
        teacher: teacherMark ? { earned: teacherMark.earned, note: teacherMark.note } : null,
        peers: peers
          .filter((m) => m.partId === part.id && reviewsHere.some((r) => r.id === m.reviewAssignmentId))
          .map((m) => ({
            earned: m.earned,
            highlightText: m.highlightText,
            criterionCode: m.criterionCode,
            reason: m.reason,
            comment: m.comment,
          })),
      };
    });

    return {
      responseId: response.id,
      studentId: response.studentId,
      studentName: roster.find((s) => s.id === response.studentId)?.name ?? "Unknown",
      isMakeup: response.isMakeup,
      score: points.filter((p) => p.earned).length,
      contestedCount: points.filter((p) => p.contested).length,
      points,
      responseText: response.text,
    };
  });

  // Most contested first — that ordering is the entire time saving.
  gradeRows.sort((a, b) => b.contestedCount - a.contestedCount || a.studentName.localeCompare(b.studentName));

  const calibration = calibrationRows
    .map((c) => ({
      studentId: c.reviewerId,
      name: nameOf.get(c.reviewerId) ?? "Unknown",
      pointsAgreed: c.pointsAgreed,
      pointsJudged: c.pointsJudged,
      reviewsAssigned: c.reviewsAssigned,
      reviewsCompleted: c.reviewsCompleted,
      accuracy: c.pointsJudged ? c.pointsAgreed / c.pointsJudged : null,
    }))
    .sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1) || a.name.localeCompare(b.name));

  return { assignment, parts, rows: gradeRows, calibration };
}

/**
 * Gradebook export. Two numbers per student: what they scored, and how well
 * they scored other people.
 */
export async function gradebookCsv(assignmentId: string): Promise<string> {
  await requireTeacher();

  const view = await gradeView(assignmentId);
  if (!view) return "";

  const header = [
    "Student",
    "Score",
    "OutOf",
    "Percent",
    "Makeup",
    ...view.parts.map((p) => `Part ${p.label}`),
    "ReviewsAssigned",
    "ReviewsCompleted",
    "CalibrationAgreed",
    "CalibrationJudged",
    "CalibrationPercent",
  ];

  const calibrationBy = new Map(view.calibration.map((c) => [c.studentId, c]));
  const outOf = view.parts.length;

  const lines = view.rows.map((row) => {
    const cal = calibrationBy.get(row.studentId);
    return [
      row.studentName,
      row.score,
      outOf,
      outOf ? Math.round((row.score / outOf) * 100) : 0,
      row.isMakeup ? "yes" : "",
      ...row.points.map((p) => (p.earned ? 1 : 0)),
      cal?.reviewsAssigned ?? 0,
      cal?.reviewsCompleted ?? 0,
      cal?.pointsAgreed ?? 0,
      cal?.pointsJudged ?? 0,
      cal?.accuracy != null ? Math.round(cal.accuracy * 100) : "",
    ];
  });

  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [header, ...lines].map((row) => row.map(escape).join(",")).join("\n");
}
