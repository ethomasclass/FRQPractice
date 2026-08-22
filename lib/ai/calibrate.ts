/**
 * Measures the AI scorer against real AP readers before it is trusted with
 * anybody's grade.
 *
 * The scorer carries a lot of weight in this app: it breaks ties on student
 * scores AND it is the yardstick every reviewer's calibration is measured
 * against. So it should be measured, not assumed. Point this at responses that
 * already have official scores and it reports per-part agreement.
 *
 * It also reports what the run actually cost, so choosing a cheaper model is a
 * measured tradeoff rather than a guess. Compare two models directly:
 *
 *   npm run ai:calibrate -- fixtures/calibration.json
 *   SCORING_MODEL=claude-sonnet-5 npm run ai:calibrate -- fixtures/calibration.json
 *
 * Usage:
 *   npm run ai:calibrate -- fixtures/calibration.json
 *
 * The fixture is JSON in this shape — transcribe it from the "Sample Student
 * Responses and Scoring Commentary" PDFs on AP Central, which publish real
 * responses alongside the score each part received:
 *
 * {
 *   "intro": "The EU and ASEAN are supranational organizations...",
 *   "parts": [
 *     { "label": "A", "taskVerb": "Define", "promptText": "Define the concept of an independent state.",
 *       "criteria": [{ "code": "A1", "text": "The primary building block of the world political map." }] }
 *   ],
 *   "samples": [
 *     { "name": "2025 Set 1 Q1 Sample A", "responseText": "...", "officialScores": { "A": true, "B": false } }
 *   ]
 * }
 */
import { readFileSync } from "node:fs";
import { scoreResponse, type ScorablePart } from "./score";
import { SCORING_EFFORT, SCORING_MODEL } from "./client";

/**
 * Published per-million-token rates, used only to turn a calibration run into a
 * per-semester estimate. Update if pricing changes; a missing model just skips
 * the cost line rather than guessing.
 */
const RATES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** 50 students x 5 FRQs a semester, scored once each. */
const RESPONSES_PER_SEMESTER = 250;

type Fixture = {
  intro?: string;
  stimulusText?: string;
  parts: (Omit<ScorablePart, "id" | "graderNote"> & { graderNote?: string })[];
  samples: { name: string; responseText: string; officialScores: Record<string, boolean> }[];
};

async function main() {
  console.log(`Scoring with ${SCORING_MODEL} at effort ${SCORING_EFFORT}.\n`);
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run ai:calibrate -- <fixture.json>");
    process.exit(1);
  }

  const fixture: Fixture = JSON.parse(readFileSync(path, "utf8"));
  const parts: ScorablePart[] = fixture.parts.map((p, i) => ({
    id: String(i),
    graderNote: p.graderNote ?? "",
    ...p,
  }));

  let agreed = 0;
  let judged = 0;
  const disagreements: string[] = [];
  // Which direction the scorer errs matters more than the headline number: a
  // scorer that is too generous inflates grades, one that is too harsh
  // punishes reviewers who were right.
  let falseEarned = 0;
  let falseMissed = 0;
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let outputTokens = 0;

  for (const sample of fixture.samples) {
    const { parts: results, usage } = await scoreResponse({
      intro: fixture.intro ?? "",
      stimulusText: fixture.stimulusText ?? "",
      parts,
      responseText: sample.responseText,
    });

    inputTokens += usage.inputTokens;
    cacheReadTokens += usage.cacheReadTokens;
    outputTokens += usage.outputTokens;

    const marks = results.map((r) => {
      const official = sample.officialScores[r.label];
      if (official === undefined) return `${r.label}:—`;

      judged += 1;
      if (r.earned === official) {
        agreed += 1;
        return `${r.label}:✓`;
      }

      if (r.earned && !official) falseEarned += 1;
      else falseMissed += 1;
      disagreements.push(
        `  ${sample.name} part ${r.label}: official ${official ? "EARNED" : "NOT EARNED"}, ` +
          `scorer said ${r.earned ? "EARNED" : "NOT EARNED"} (confidence ${r.confidence.toFixed(2)})\n` +
          `    reasoning: ${r.justification}`,
      );
      return `${r.label}:✗`;
    });

    console.log(`${sample.name.padEnd(32)} ${marks.join(" ")}`);
  }

  const pct = judged ? ((agreed / judged) * 100).toFixed(1) : "0.0";
  console.log(`\nAgreement: ${agreed}/${judged} points (${pct}%)`);
  console.log(`  Too generous (scored earned, readers did not): ${falseEarned}`);
  console.log(`  Too harsh (scored not earned, readers did):    ${falseMissed}`);

  const rate = RATES[SCORING_MODEL];
  if (rate && fixture.samples.length) {
    // Cached reads bill at roughly a tenth of fresh input.
    const cost =
      (inputTokens * rate.input) / 1e6 +
      (cacheReadTokens * rate.input * 0.1) / 1e6 +
      (outputTokens * rate.output) / 1e6;
    const perResponse = cost / fixture.samples.length;
    console.log(
      `\nCost: $${cost.toFixed(4)} for ${fixture.samples.length} responses ` +
        `($${perResponse.toFixed(4)} each) — about $${(perResponse * RESPONSES_PER_SEMESTER).toFixed(2)} ` +
        `to score a semester.`,
    );
    console.log(
      `  ${inputTokens.toLocaleString()} input, ${cacheReadTokens.toLocaleString()} cached, ` +
        `${outputTokens.toLocaleString()} output (thinking included).`,
    );
    console.log("  Feedback writing roughly doubles this. Both are separate from any claude.ai subscription.");
  }

  if (disagreements.length) {
    console.log(`\nDisagreements:\n${disagreements.join("\n")}`);
  }

  // A scorer below this is not fit to break ties or to grade reviewers.
  const THRESHOLD = 0.9;
  if (judged && agreed / judged < THRESHOLD) {
    console.log(`\nBelow the ${THRESHOLD * 100}% bar. Tune the scoring prompt before trusting this with grades.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
