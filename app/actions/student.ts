"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignments, responses, reviewAssignments } from "@/lib/db/schema";
import { requireStudent } from "@/lib/auth";

export type StudentTask =
  | { kind: "write"; assignmentId: string; title: string; timeLimitMinutes: number; isMakeup: boolean }
  | { kind: "review"; assignmentId: string; title: string; done: number; total: number }
  | { kind: "waiting"; assignmentId: string; title: string; detail: string }
  | { kind: "result"; assignmentId: string; title: string };

export async function studentDashboard() {
  const { student, section } = await requireStudent();

  const visible = await db.query.assignments.findMany({
    where: and(eq(assignments.sectionId, section.id)),
  });
  const live = visible.filter((a) => a.status !== "draft");
  if (live.length === 0) return { student, section, tasks: [] as StudentTask[] };

  const ids = live.map((a) => a.id);

  const myResponses = await db.query.responses.findMany({
    where: and(inArray(responses.assignmentId, ids), eq(responses.studentId, student.id)),
  });
  const byAssignment = new Map(myResponses.map((r) => [r.assignmentId, r]));

  const myReviews = await db.query.reviewAssignments.findMany({
    where: eq(reviewAssignments.reviewerId, student.id),
  });
  const reviewResponseIds = myReviews.map((r) => r.responseId);
  const reviewTargets = reviewResponseIds.length
    ? await db.query.responses.findMany({ where: inArray(responses.id, reviewResponseIds) })
    : [];
  const targetAssignment = new Map(reviewTargets.map((r) => [r.id, r.assignmentId]));

  const tasks: StudentTask[] = [];

  for (const a of live.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())) {
    const mine = byAssignment.get(a.id);

    if (a.status === "released") {
      if (mine?.submittedAt) tasks.push({ kind: "result", assignmentId: a.id, title: a.title });
      continue;
    }

    if (a.status === "writing" && !mine?.submittedAt) {
      tasks.push({
        kind: "write",
        assignmentId: a.id,
        title: a.title,
        timeLimitMinutes: a.timeLimitMinutes,
        isMakeup: false,
      });
      continue;
    }

    if (a.status === "reviewing") {
      const forThis = myReviews.filter((r) => targetAssignment.get(r.responseId) === a.id);
      if (forThis.length > 0) {
        tasks.push({
          kind: "review",
          assignmentId: a.id,
          title: a.title,
          done: forThis.filter((r) => r.completedAt).length,
          total: forThis.length,
        });
        continue;
      }
      // No reviews assigned means they missed the writing day: let them make it up.
      if (!mine?.submittedAt) {
        tasks.push({ kind: "write", assignmentId: a.id, title: a.title, timeLimitMinutes: a.timeLimitMinutes, isMakeup: true });
        continue;
      }
    }

    if (mine?.submittedAt) {
      tasks.push({
        kind: "waiting",
        assignmentId: a.id,
        title: a.title,
        detail: a.status === "adjudicating" ? "Your teacher is finishing grading." : "Waiting on peer review to finish.",
      });
    }
  }

  return { student, section, tasks };
}
