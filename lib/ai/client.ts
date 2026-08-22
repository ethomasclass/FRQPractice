import Anthropic from "@anthropic-ai/sdk";

/**
 * Every response is scored and every piece of feedback is written by Claude
 * Opus 5. Scoring is the same judgment that decides a student's grade and a
 * reviewer's calibration, so this is not a place to trade accuracy for cost --
 * at roughly 250 responses a semester the whole bill is a few dollars.
 */
export const SCORING_MODEL = "claude-opus-5";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env to enable AI scoring and feedback.");
  }
  cached ??= new Anthropic();
  return cached;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
