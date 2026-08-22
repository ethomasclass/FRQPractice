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
  sections,
  students,
  type AssignmentStatus,
} from "@/lib/db/schema";
import { generateJoinCode, newId, requireTeacher } from "@/lib/auth";
import { assignReviews } from "@/lib/scoring";

/* --------------------------- sections + roster --------------------------- */

export async function listSections() {
  await requireTeacher();
  const rows = await db.query.sections.findMany();
  const counts = await db.query.students.findMany();
  return rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ ...s, studentCount: counts.filter((c) => c.sectionId === s.id).length }));
}

export async function createSection(_prev: unknown, formData: FormData) {
  await requireTeacher();
  const name = String(formData.get("name") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();
  if (!name) return { error: "Give the class a name." };

  // Collisions are vanishingly unlikely but cheap to rule out.
  let joinCode = generateJoinCode();
  while (await db.query.sections.findFirst({ where: eq(sections.joinCode, joinCode) })) {
    joinCode = generateJoinCode();
  }

  await db.insert(sections).values({ id: newId(), name, term, joinCode });
  revalidatePath("/teacher/classes");
  return { ok: true as const };
}

/**
 * Roster import by paste. One student per line, "Name" or "Name, email".
 * Existing students are matched by name so re-pasting a roster doesn't
 * duplicate anyone or orphan their submitted work.
 */
export async function importRoster(sectionId: string, raw: string) {
  await requireTeacher();

  const existing = await db.query.students.findMany({ where: eq(students.sectionId, sectionId) });
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));

  const parsed = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, email] = line.split(/[,\t]/).map((v) => v?.trim() ?? "");
      return { name, email: email ?? "" };
    })
    .filter((s) => s.name);

  let added = 0;
  let updated = 0;
  for (const entry of parsed) {
    const match = byName.get(entry.name.toLowerCase());
    if (match) {
      if (entry.email && entry.email !== match.email) {
        await db.update(students).set({ email: entry.email }).where(eq(students.id, match.id));
        updated += 1;
      }
    } else {
      await db.insert(students).values({ id: newId(), sectionId, name: entry.name, email: entry.email });
      added += 1;
    }
  }

  revalidatePath(`/teacher/sections/${sectionId}`);
  return { added, updated, total: parsed.length };
}

export async function removeStudent(studentId: string) {
  await requireTeacher();
  await db.delete(students).where(eq(students.id, studentId));
  revalidatePath("/teacher");
  return { ok: true as const };
}

/* ------------------------------ assignments ------------------------------ */

export async function listAssignments() {
  await requireTeacher();
  const rows = await db.query.assignments.findMany();
  const allSections = await db.query.sections.findMany();
  const sectionName = new Map(allSections.map((s) => [s.id, s.name]));

  const ids = rows.map((r) => r.id);
  const allResponses = ids.length
    ? await db.query.responses.findMany({ where: inArray(responses.assignmentId, ids) })
    : [];
  const rosterCounts = await db.query.students.findMany();

  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((a) => {
      const mine = allResponses.filter((r) => r.assignmentId === a.id);
      return {
        ...a,
        sectionName: sectionName.get(a.sectionId) ?? "Unknown class",
        rosterCount: rosterCounts.filter((s) => s.sectionId === a.sectionId).length,
        submittedCount: mine.filter((r) => r.submittedAt).length,
      };
    });
}

export async function setAssignmentStatus(assignmentId: string, status: AssignmentStatus) {
  await requireTeacher();
  await db.update(assignments).set({ status }).where(eq(assignments.id, assignmentId));
  revalidatePath("/teacher");
  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const };
}

/**
 * Closes writing and hands out peer reviews.
 *
 * Only responses that actually exist go into the pool, so students who were
 * absent are skipped automatically -- no roster surgery, no blocked classmates.
 */
export async function assignPeerReviews(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) throw new Error("NOT_FOUND");

  const submitted = (
    await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) })
  ).filter((r) => r.submittedAt);

  if (submitted.length < 2) {
    return { error: "Need at least two submitted responses before reviews can be handed out." };
  }

  // Only students who submitted get review work: reviewing is graded, and
  // grading someone who never wrote anything is not a fair thing to assign.
  const reviewerIds = submitted.map((r) => r.studentId);

  const pairs = assignReviews({
    responses: submitted.map((r) => ({ responseId: r.id, studentId: r.studentId })),
    reviewerIds,
    reviewsPerResponse: assignment.reviewsPerResponse,
  });

  // Re-running is safe: clear any previous round first.
  const existing = await db.query.reviewAssignments.findMany({
    where: inArray(reviewAssignments.responseId, submitted.map((r) => r.id)),
  });
  if (existing.length) {
    await db.delete(peerMarks).where(inArray(peerMarks.reviewAssignmentId, existing.map((e) => e.id)));
    await db.delete(reviewAssignments).where(inArray(reviewAssignments.id, existing.map((e) => e.id)));
  }

  if (pairs.length) {
    await db.insert(reviewAssignments).values(
      pairs.map((p) => ({
        id: newId(),
        responseId: p.responseId,
        reviewerId: p.reviewerId,
        displayIndex: p.displayIndex,
      })),
    );
  }

  await db.update(assignments).set({ status: "reviewing" }).where(eq(assignments.id, assignmentId));
  revalidatePath("/teacher");
  return { ok: true as const, assigned: pairs.length, responses: submitted.length };
}

export async function loadAssignment(assignmentId: string) {
  await requireTeacher();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) return null;

  const section = await db.query.sections.findFirst({ where: eq(sections.id, assignment.sectionId) });
  const parts = (await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) })).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const criteria = parts.length
    ? await db.query.rubricCriteria.findMany({ where: inArray(rubricCriteria.partId, parts.map((p) => p.id)) })
    : [];

  const roster = section ? await db.query.students.findMany({ where: eq(students.sectionId, section.id) }) : [];
  const rows = await db.query.responses.findMany({ where: eq(responses.assignmentId, assignmentId) });
  const reviews = rows.length
    ? await db.query.reviewAssignments.findMany({ where: inArray(reviewAssignments.responseId, rows.map((r) => r.id)) })
    : [];

  return {
    assignment,
    section,
    parts: parts.map((p) => ({
      ...p,
      criteria: criteria.filter((c) => c.partId === p.id).sort((a, b) => a.orderIndex - b.orderIndex),
    })),
    roster: roster.sort((a, b) => a.name.localeCompare(b.name)),
    responses: rows,
    reviewProgress: {
      total: reviews.length,
      complete: reviews.filter((r) => r.completedAt).length,
    },
  };
}

export async function createAssignment(_prev: unknown, formData: FormData) {
  await requireTeacher();
  const sectionId = String(formData.get("sectionId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!sectionId || !title) return { error: "Pick a class and give the FRQ a title." };

  const id = newId();
  await db.insert(assignments).values({
    id,
    sectionId,
    title,
    intro: String(formData.get("intro") ?? "").trim(),
    timeLimitMinutes: Number(formData.get("timeLimitMinutes") ?? 25) || 0,
    reviewsPerResponse: Number(formData.get("reviewsPerResponse") ?? 4) || 4,
    status: "draft",
  });

  revalidatePath("/teacher");
  return { ok: true as const, id };
}

export async function deleteAssignment(assignmentId: string) {
  await requireTeacher();
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  revalidatePath("/teacher");
  return { ok: true as const };
}

/* -------------------------------- rubric --------------------------------- */

export async function saveRubric(
  assignmentId: string,
  parts: {
    label: string;
    taskVerb: "Define" | "Identify" | "Describe" | "Explain" | "Compare";
    promptText: string;
    graderNote: string;
    criteria: { code: string; text: string }[];
  }[],
) {
  await requireTeacher();

  const existing = await db.query.rubricParts.findMany({ where: eq(rubricParts.assignmentId, assignmentId) });
  if (existing.length) {
    await db.delete(rubricCriteria).where(inArray(rubricCriteria.partId, existing.map((p) => p.id)));
    await db.delete(rubricParts).where(eq(rubricParts.assignmentId, assignmentId));
  }

  for (const [i, part] of parts.entries()) {
    const partId = newId();
    await db.insert(rubricParts).values({
      id: partId,
      assignmentId,
      label: part.label,
      orderIndex: i,
      taskVerb: part.taskVerb,
      promptText: part.promptText,
      graderNote: part.graderNote,
    });
    const rows = part.criteria.filter((c) => c.text.trim());
    if (rows.length) {
      await db.insert(rubricCriteria).values(
        rows.map((c, j) => ({
          id: newId(),
          partId,
          code: c.code || `${part.label}${j + 1}`,
          orderIndex: j,
          text: c.text.trim(),
        })),
      );
    }
  }

  revalidatePath(`/teacher/assignments/${assignmentId}`);
  return { ok: true as const };
}

export async function unsubmittedStudents(assignmentId: string) {
  await requireTeacher();
  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment) return [];
  const roster = await db.query.students.findMany({ where: eq(students.sectionId, assignment.sectionId) });
  const rows = await db.query.responses.findMany({
    where: and(eq(responses.assignmentId, assignmentId)),
  });
  const submitted = new Set(rows.filter((r) => r.submittedAt).map((r) => r.studentId));
  return roster.filter((s) => !submitted.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
}
