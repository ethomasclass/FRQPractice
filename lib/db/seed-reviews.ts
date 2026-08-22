/**
 * Development only. Completes every outstanding peer review with plausible,
 * deliberately imperfect judgments so the settling, contested-point, and
 * calibration paths can be exercised without an API key or twenty volunteers.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, inArray } from "drizzle-orm";
import * as schema from "./schema";

const newId = () => randomBytes(16).toString("hex");

const REASONS = ["described_not_explained", "too_vague", "no_geographic_reasoning", "restates_prompt"] as const;

/** Deterministic pseudo-randomness, so a rerun reproduces the same disagreements. */
function hashFloat(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const assignment = await db.query.assignments.findFirst();
  if (!assignment) throw new Error("No assignment. Run npm run db:seed first.");

  const parts = (
    await db.query.rubricParts.findMany({ where: eq(schema.rubricParts.assignmentId, assignment.id) })
  ).sort((a, b) => a.orderIndex - b.orderIndex);

  const rows = await db.query.responses.findMany({ where: eq(schema.responses.assignmentId, assignment.id) });
  const reviews = await db.query.reviewAssignments.findMany({
    where: inArray(schema.reviewAssignments.responseId, rows.map((r) => r.id)),
  });
  const pending = reviews.filter((r) => !r.completedAt);

  // A student may already have judged some parts by hand; leave those alone.
  const existingMarks = pending.length
    ? await db.query.peerMarks.findMany({
        where: inArray(schema.peerMarks.reviewAssignmentId, pending.map((r) => r.id)),
      })
    : [];

  for (const review of pending) {
    const response = rows.find((r) => r.id === review.responseId)!;
    const alreadyJudged = new Set(
      existingMarks.filter((m) => m.reviewAssignmentId === review.id).map((m) => m.partId),
    );
    // Longer, more developed answers earn more points — a crude but stable
    // proxy for quality, with per-reviewer noise layered on top.
    const quality = Math.min(1, response.text.length / 2600);

    for (const part of parts) {
      if (alreadyJudged.has(part.id)) continue;
      const roll = hashFloat(`${review.id}:${part.id}`);
      const earned = roll < quality;
      await db.insert(schema.peerMarks).values({
        id: newId(),
        reviewAssignmentId: review.id,
        partId: part.id,
        earned,
        highlightStart: earned ? 0 : null,
        highlightEnd: earned ? 60 : null,
        highlightText: earned ? response.text.slice(0, 60) : "",
        criterionCode: earned ? `${part.label}1` : "",
        reason: earned ? null : REASONS[Math.floor(roll * REASONS.length) % REASONS.length],
        comment: "",
      });
    }

    await db.update(schema.reviewAssignments).set({ completedAt: new Date() }).where(eq(schema.reviewAssignments.id, review.id));
  }

  await db.update(schema.assignments).set({ status: "adjudicating" }).where(eq(schema.assignments.id, assignment.id));

  console.log(`Completed ${pending.length} peer reviews across ${parts.length} parts each.`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
