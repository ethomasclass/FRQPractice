import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const now = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

export const sections = sqliteTable("sections", {
  id: id(),
  name: text("name").notNull(),                       // "AP HuG - Period 2"
  term: text("term").notNull().default(""),           // "Fall 2026"
  joinCode: text("join_code").notNull(),              // students type this once
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: now(),
}, (t) => [uniqueIndex("sections_join_code_idx").on(t.joinCode)]);

export const students = sqliteTable("students", {
  id: id(),
  sectionId: text("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  createdAt: now(),
}, (t) => [index("students_section_idx").on(t.sectionId)]);

/* ------------------------------------------------------------------ */
/* Assignments + rubric                                                */
/* ------------------------------------------------------------------ */

/**
 * Lifecycle, in order. The teacher advances it manually — nothing is on a
 * cron, because class periods slip and a timer that fires during a fire drill
 * is worse than a button.
 */
export type AssignmentStatus =
  | "draft"        // teacher still editing prompt + rubric
  | "writing"      // students can write
  | "reviewing"    // writing closed, peers reviewing
  | "adjudicating" // reviews closed, teacher settling contested points
  | "released";    // students can see scores + feedback

export const assignments = sqliteTable("assignments", {
  id: id(),
  sectionId: text("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /** Scene-setter shown above the parts, e.g. "The EU and ASEAN are supranational organizations…" */
  intro: text("intro").notNull().default(""),
  /** Optional stimulus: a table, chart description, or image URL. */
  stimulusText: text("stimulus_text").notNull().default(""),
  stimulusImageUrl: text("stimulus_image_url").notNull().default(""),
  /** Minutes on the clock once a student opens the prompt. 0 = untimed. */
  timeLimitMinutes: integer("time_limit_minutes").notNull().default(25),
  /** How many peers review each response. */
  reviewsPerResponse: integer("reviews_per_response").notNull().default(4),
  status: text("status").$type<AssignmentStatus>().notNull().default("draft"),
  /** Provenance, so the teacher can tell at a glance what the AI drafted. */
  source: text("source").$type<"teacher" | "ai">().notNull().default("teacher"),
  createdAt: now(),
}, (t) => [index("assignments_section_idx").on(t.sectionId)]);

/**
 * One part = one point. This mirrors the College Board scoring guideline
 * exactly: a task verb, a prompt, and an enumerated list of acceptable
 * responses that a reader matches against.
 */
export const rubricParts = sqliteTable("rubric_parts", {
  id: id(),
  assignmentId: text("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  label: text("label").notNull(),                     // "A" … "G"
  orderIndex: integer("order_index").notNull(),
  /** Define | Describe | Explain | Compare — drives both AI scoring and the reviewer's reason list. */
  taskVerb: text("task_verb").$type<TaskVerb>().notNull().default("Explain"),
  promptText: text("prompt_text").notNull(),          // "Explain how deindustrialization has affected…"
  /** Optional note the teacher wants graders to keep in mind. Never shown to the writer. */
  graderNote: text("grader_note").notNull().default(""),
}, (t) => [index("rubric_parts_assignment_idx").on(t.assignmentId)]);

export type TaskVerb = "Define" | "Identify" | "Describe" | "Explain" | "Compare";

/**
 * "Examples of acceptable responses may include the following: • C7. New
 * manufacturing zones…" — each bullet is a row here. Reviewers and the AI cite
 * the code, which is what makes disagreement legible instead of vibes.
 */
export const rubricCriteria = sqliteTable("rubric_criteria", {
  id: id(),
  partId: text("part_id").notNull().references(() => rubricParts.id, { onDelete: "cascade" }),
  code: text("code").notNull(),                       // "C7"
  orderIndex: integer("order_index").notNull(),
  text: text("text").notNull(),
}, (t) => [index("rubric_criteria_part_idx").on(t.partId)]);

/* ------------------------------------------------------------------ */
/* Student responses                                                   */
/* ------------------------------------------------------------------ */

export const responses = sqliteTable("responses", {
  id: id(),
  assignmentId: text("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  text: text("text").notNull().default(""),
  /** Server-authoritative clock. Set the first time the student opens the prompt. */
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  autoSubmitted: integer("auto_submitted", { mode: "boolean" }).notNull().default(false),
  /** Written after the review window closed: AI-scored only, no peers. */
  isMakeup: integer("is_makeup", { mode: "boolean" }).notNull().default(false),
  releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  createdAt: now(),
}, (t) => [
  uniqueIndex("responses_assignment_student_idx").on(t.assignmentId, t.studentId),
  index("responses_assignment_idx").on(t.assignmentId),
]);

/* ------------------------------------------------------------------ */
/* Peer review                                                         */
/* ------------------------------------------------------------------ */

export const reviewAssignments = sqliteTable("review_assignments", {
  id: id(),
  responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  /** Reviewers see "Response 3 of 4", never a name. */
  displayIndex: integer("display_index").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: now(),
}, (t) => [
  uniqueIndex("review_assignments_pair_idx").on(t.responseId, t.reviewerId),
  index("review_assignments_reviewer_idx").on(t.reviewerId),
]);

/**
 * Why a reviewer withheld a point. Seeded from the Chief Reader reports, which
 * describe the same handful of failures every single year.
 */
export type NotEarnedReason =
  | "described_not_explained"   // the #1 killer on Explain parts
  | "restates_prompt"
  | "too_vague"
  | "no_geographic_reasoning"
  | "wrong_concept"
  | "answers_different_part"
  | "not_addressed";

export const peerMarks = sqliteTable("peer_marks", {
  id: id(),
  reviewAssignmentId: text("review_assignment_id").notNull().references(() => reviewAssignments.id, { onDelete: "cascade" }),
  partId: text("part_id").notNull().references(() => rubricParts.id, { onDelete: "cascade" }),
  earned: integer("earned", { mode: "boolean" }).notNull(),
  /** Character offsets into responses.text — the evidence the reviewer pointed at. */
  highlightStart: integer("highlight_start"),
  highlightEnd: integer("highlight_end"),
  highlightText: text("highlight_text").notNull().default(""),
  /** Which acceptance criterion they think it matched. */
  criterionCode: text("criterion_code").notNull().default(""),
  reason: text("reason").$type<NotEarnedReason>(),
  comment: text("comment").notNull().default(""),
  createdAt: now(),
}, (t) => [
  uniqueIndex("peer_marks_review_part_idx").on(t.reviewAssignmentId, t.partId),
]);

/* ------------------------------------------------------------------ */
/* AI + teacher marks                                                  */
/* ------------------------------------------------------------------ */

/**
 * Scored before any peer input is visible, which is what lets it serve double
 * duty: tiebreaker for the writer's grade, and an independent yardstick for
 * reviewer calibration. If it saw peer scores first, calibration would just be
 * measuring conformity.
 */
export const aiMarks = sqliteTable("ai_marks", {
  id: id(),
  responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  partId: text("part_id").notNull().references(() => rubricParts.id, { onDelete: "cascade" }),
  earned: integer("earned", { mode: "boolean" }).notNull(),
  criterionCode: text("criterion_code").notNull().default(""),
  quote: text("quote").notNull().default(""),
  justification: text("justification").notNull().default(""),
  confidence: real("confidence").notNull().default(0),
  model: text("model").notNull().default(""),
  createdAt: now(),
}, (t) => [uniqueIndex("ai_marks_response_part_idx").on(t.responseId, t.partId)]);

export const teacherMarks = sqliteTable("teacher_marks", {
  id: id(),
  responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  partId: text("part_id").notNull().references(() => rubricParts.id, { onDelete: "cascade" }),
  earned: integer("earned", { mode: "boolean" }).notNull(),
  note: text("note").notNull().default(""),
  createdAt: now(),
}, (t) => [uniqueIndex("teacher_marks_response_part_idx").on(t.responseId, t.partId)]);

/** Where a settled point came from. Teacher always wins; AI settles peer splits. */
export type MarkSource = "peer_majority" | "ai_tiebreak" | "ai_only" | "teacher";

export const finalMarks = sqliteTable("final_marks", {
  id: id(),
  responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  partId: text("part_id").notNull().references(() => rubricParts.id, { onDelete: "cascade" }),
  earned: integer("earned", { mode: "boolean" }).notNull(),
  source: text("source").$type<MarkSource>().notNull(),
  /** Peers split, or peers disagreed with the AI. Sorts the teacher's queue. */
  contested: integer("contested", { mode: "boolean" }).notNull().default(false),
  peerEarnedCount: integer("peer_earned_count").notNull().default(0),
  peerTotalCount: integer("peer_total_count").notNull().default(0),
  createdAt: now(),
}, (t) => [uniqueIndex("final_marks_response_part_idx").on(t.responseId, t.partId)]);

/* ------------------------------------------------------------------ */
/* Feedback + calibration                                              */
/* ------------------------------------------------------------------ */

export const aiFeedback = sqliteTable("ai_feedback", {
  id: id(),
  responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }).unique(),
  /** Plain-language, written from the settled marks + what peers and the teacher highlighted. */
  body: text("body").notNull().default(""),
  model: text("model").notNull().default(""),
  createdAt: now(),
});

/**
 * A reviewer's grade: how often they agreed with the AI's independent read.
 * Recomputed when the teacher overrides, so their judgment propagates.
 */
export const calibrationScores = sqliteTable("calibration_scores", {
  id: id(),
  assignmentId: text("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  pointsAgreed: integer("points_agreed").notNull().default(0),
  pointsJudged: integer("points_judged").notNull().default(0),
  reviewsAssigned: integer("reviews_assigned").notNull().default(0),
  reviewsCompleted: integer("reviews_completed").notNull().default(0),
  createdAt: now(),
}, (t) => [uniqueIndex("calibration_assignment_reviewer_idx").on(t.assignmentId, t.reviewerId)]);

/* ------------------------------------------------------------------ */
/* Sessions + exemplars                                                */
/* ------------------------------------------------------------------ */

export const sessions = sqliteTable("sessions", {
  id: id(),
  role: text("role").$type<"teacher" | "student">().notNull(),
  studentId: text("student_id").references(() => students.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: now(),
});

/**
 * Released College Board material the teacher uploads. Used as few-shot style
 * exemplars for rubric generation and as a calibration set for the AI scorer.
 * Copyrighted — stays in the teacher's own database, never in the repo.
 */
export const exemplars = sqliteTable("exemplars", {
  id: id(),
  title: text("title").notNull(),
  kind: text("kind").$type<"frq" | "scoring_guideline" | "chief_reader">().notNull(),
  year: integer("year"),
  body: text("body").notNull(),
  createdAt: now(),
});
