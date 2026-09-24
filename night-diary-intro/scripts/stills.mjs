// Renders review stills (one or more per scene) to out/stills/ with a single bundle.
// Usage: node scripts/stills.mjs [frame ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_FRAMES = [
  200, 280, // 1 night
  390, 520, 640, // 2 nisha
  720, 900, // 3 world
  1150, 1400, 1600, // 4 names
  1700, 1900, 2100, // 5 line
  2300, 2420, 2580, // 6 movement
  2800, 2950, 3100, // 7 question
  3230, 3400, // 8 title
  3520, // 9 hook
];
const frames = process.argv.slice(2).map(Number);
const list = frames.length ? frames : DEFAULT_FRAMES;

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const composition = await selectComposition({ serveUrl, id: "NightDiaryIntro", browserExecutable });
mkdirSync("out/stills", { recursive: true });
for (const frame of list) {
  const output = `out/stills/f${String(frame).padStart(4, "0")}.jpg`;
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "jpeg", jpegQuality: 85, browserExecutable });
  console.log(output);
}
