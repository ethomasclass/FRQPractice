/**
 * Measures the AI scorer against real AP readers before it is trusted with
 * anybody's grade.
 *
 * The scorer carries a lot of weight in this app: it breaks ties on student
 * scores AND it is the yardstick every reviewer's calibration is measured
 * against. So it should be measured, not assumed. Point this at responses that
 * already have official scores and it reports per-part agreement.
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

type Fixture = {
  intro?: string;
  stimulusText?: string;
  parts: (Omit<ScorablePart, "id" | "graderNote"> & { graderNote?: string })[];
  samples: { name: string; responseText: string; officialScores: Record<string, boolean> }[];
};

async function main() {
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

  for (const sample of fixture.samples) {
    const results = await scoreResponse({
      intro: fixture.intro ?? "",
      stimulusText: fixture.stimulusText ?? "",
      parts,
      responseText: sample.responseText,
    });

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
