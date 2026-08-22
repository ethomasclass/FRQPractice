"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { exemplars } from "@/lib/db/schema";
import { requireTeacher } from "@/lib/auth";
import { draftRubric } from "@/lib/ai/generate";

export type DraftResult =
  | { ok: true; draft: Awaited<ReturnType<typeof draftRubric>> }
  | { error: string };

/**
 * Drafts a question and rubric and hands it straight back to the browser
 * WITHOUT writing anything.
 *
 * That is the whole guardrail. A rubric is the definition of correct for peer
 * scoring, AI scoring, and reviewer calibration all at once, so a mediocre one
 * quietly corrupts every number the app produces. Nothing reaches the database
 * until the teacher has read it and pressed Save.
 */
export async function draftRubricAction(args: {
  topic: string;
  partCount: number;
  notes: string;
  exemplarIds: string[];
}): Promise<DraftResult> {
  await requireTeacher();

  const topic = args.topic.trim();
  if (!topic) return { error: "Say what the question should be about." };

  const partCount = Math.min(10, Math.max(2, args.partCount || 7));

  const chosen = args.exemplarIds.length
    ? await db.query.exemplars.findMany({ where: inArray(exemplars.id, args.exemplarIds) })
    : [];

  try {
    const draft = await draftRubric({
      topic,
      partCount,
      // Two or three is plenty to establish the house style, and keeps the
      // request small enough to stay well inside a serverless time budget.
      exemplars: chosen.slice(0, 3).map((e) => e.body),
      notes: args.notes.trim() || undefined,
    });
    return { ok: true, draft };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
