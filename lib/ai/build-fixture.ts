/**
 * Turns College Board "Sample Student Responses and Scoring Commentary" PDFs
 * into a calibration fixture.
 *
 * Those PDFs are the only public source that pairs a real student response
 * with the score each individual part received, which is exactly what is
 * needed to check the scorer against actual readers.
 *
 * Convert the PDFs to text first (poppler's pdftotext, `brew install poppler`
 * or `apt install poppler-utils`), then point this at the .txt files:
 *
 *   pdftotext -layout ap25-apc-human-geography-q1-set-1.pdf q1set1.txt
 *   npm run ai:fixture -- fixtures/calibration.json q1set1.txt q1set2.txt
 *
 * The output contains copyrighted College Board text. Keep it local — the
 * fixtures directory is gitignored for that reason.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

type Criterion = { code: string; text: string };
type Part = { label: string; taskVerb: string; promptText: string; criteria: Criterion[] };
type Sample = { name: string; responseText: string; officialScores: Record<string, boolean> };

const VERBS = ["Define", "Identify", "Describe", "Explain", "Compare"];

/** Page furniture that pdftotext interleaves with the content. */
const NOISE = [
  /^©\s*\d{4}\s*College Board/i,
  /^AP®? Human Geography \d{4}/i,
  /^Visit College Board on the web/i,
  /^AP Central is the official online home/i,
  /^Sample \d[A-Z] \d+ of \d+$/,
  /^Question \d+\b/,
];

/** Everything after one of these belongs to the commentary, not a response. */
const END_OF_RESPONSES = [
  /^Sample:\s*\d[A-Z]\s*$/,
  /^\s*Note: Student samples are quoted verbatim/i,
  /^\s*Overview\s*$/,
];

const isNoise = (line: string) => NOISE.some((re) => re.test(line.trim()));

function parseRubric(text: string): Part[] {
  const lines = text.split("\n");
  const parts: Part[] = [];

  // A part header looks like:  " A   Define the concept of ...   1 point"
  // followed by " (Point 1)  Examples of acceptable responses..."
  // The prompt sometimes wraps onto the "(Point n)" line.
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^\s{1,3}([A-G])\s{2,}(.+?)\s{2,}1 point\s*$/);
    if (!header) continue;

    const label = header[1];
    let promptText = header[2].trim();

    const cont = lines[i + 1]?.match(/^\s*\(Point \d+\)\s{2,}(.+)$/);
    if (cont && !/Examples of acceptable responses/i.test(cont[1])) {
      promptText += ` ${cont[1].trim()}`;
    }

    const criteria: Criterion[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      // Stop at the next part header.
      if (/^\s{1,3}[A-G]\s{2,}.+\s{2,}1 point\s*$/.test(lines[j])) break;
      // Stop when the samples begin.
      if (/^\s*Sample \d[A-Z] \d+ of \d+/.test(lines[j])) break;

      const bullet = lines[j].match(/^\s*[•·]\s*([A-G]\d+)\.\s*(.+)$/);
      if (bullet) {
        criteria.push({ code: bullet[1], text: bullet[2].trim() });
        continue;
      }
      // Wrapped continuation of the previous bullet.
      if (criteria.length > 0 && /^\s{15,}\S/.test(lines[j]) && !isNoise(lines[j])) {
        criteria[criteria.length - 1].text += ` ${lines[j].trim()}`;
      }
    }

    const verb = VERBS.find((v) => promptText.startsWith(v)) ?? "Explain";
    parts.push({ label, taskVerb: verb, promptText: promptText.replace(/\s+/g, " ").trim(), criteria });
    if (parts.length === 7) break;
  }

  return parts;
}

function parseSamples(text: string): Sample[] {
  const lines = text.split("\n");

  // Responses are delimited by "Sample 1A 1 of 2" markers; a single response
  // can span several of them.
  const bodies = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of lines) {
    const marker = line.match(/^\s*Sample (\d[A-Z]) \d+ of \d+\s*$/);
    if (marker) {
      current = marker[1];
      if (!bodies.has(current)) bodies.set(current, []);
      continue;
    }
    if (END_OF_RESPONSES.some((re) => re.test(line))) {
      current = null;
      continue;
    }
    if (current && !isNoise(line)) bodies.get(current)!.push(line);
  }

  // Scores: "Sample: 1A" then "HG Point 1 Score: 1" x7.
  const scores = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^Sample:\s*(\d[A-Z])\s*$/);
    if (!m) continue;
    const points: number[] = [];
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const p = lines[j].match(/^HG Point (\d+) Score:\s*(\d)\s*$/);
      if (p) points[Number(p[1]) - 1] = Number(p[2]);
      if (/^Score:\s*\d+/.test(lines[j])) break;
    }
    if (points.length) scores.set(m[1], points);
  }

  const out: Sample[] = [];
  for (const [name, points] of scores) {
    const body = (bodies.get(name) ?? []).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!body) {
      console.warn(`  ! Sample ${name}: scores found but no response text — skipped.`);
      continue;
    }
    const officialScores: Record<string, boolean> = {};
    points.forEach((v, idx) => {
      officialScores["ABCDEFG"[idx]] = v === 1;
    });
    out.push({ name, responseText: body, officialScores });
  }
  return out;
}

function main() {
  const [outPath, ...inputs] = process.argv.slice(2);
  if (!outPath || inputs.length === 0) {
    console.error("Usage: npm run ai:fixture -- <out.json> <sample-commentary.txt> [...]");
    process.exit(1);
  }

  const fixtures = inputs.map((file) => {
    const text = readFileSync(file, "utf8");
    const parts = parseRubric(text);
    const samples = parseSamples(text);

    console.log(
      `${basename(file)}: ${parts.length} parts, ` +
        `${parts.reduce((n, p) => n + p.criteria.length, 0)} criteria, ${samples.length} samples`,
    );
    if (parts.length !== 7) console.warn(`  ! expected 7 parts — check the parse`);
    for (const p of parts) {
      if (p.criteria.length === 0) console.warn(`  ! part ${p.label} has no acceptable responses`);
    }
    // Stimulus questions reference a chart or map that lives in the PDF as an
    // image. Scoring them without it would blame the scorer for missing data
    // it was never shown.
    const needsStimulus = /Question [23]: /.test(text);
    if (needsStimulus) {
      console.warn(`  ! this question has a stimulus (chart/map) that is not in the text.`);
      console.warn(`    Describe it in "stimulusText" before using these samples, or leave them out.`);
    }

    return {
      source: basename(file),
      needsStimulus,
      intro: "",
      stimulusText: "",
      parts,
      samples,
    };
  });

  // One fixture per file keeps each question with its own rubric.
  writeFileSync(outPath, `${JSON.stringify(fixtures.length === 1 ? fixtures[0] : fixtures, null, 2)}\n`);

  const totalPoints = fixtures.reduce(
    (n, f) => n + f.samples.reduce((m, s) => m + Object.keys(s.officialScores).length, 0),
    0,
  );
  console.log(`\nWrote ${outPath}: ${totalPoints} scored points across ${fixtures.reduce((n, f) => n + f.samples.length, 0)} responses.`);
}

main();
