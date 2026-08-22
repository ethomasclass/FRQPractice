import Anthropic from "@anthropic-ai/sdk";

/**
 * Scoring and feedback are configured separately because they are different
 * jobs. Scoring decides a student's grade AND is the yardstick every reviewer's
 * calibration is measured against, so it is the one to spend on. Feedback is
 * writing, and a smaller model does that well.
 *
 * Before moving scoring to a cheaper model, measure it:
 *   SCORING_MODEL=claude-sonnet-5 npm run ai:calibrate -- fixtures/calibration.json
 * The saving over a semester is a few dollars; a scorer that quietly hands out
 * points nobody earned costs more than that.
 */
export const SCORING_MODEL = process.env.SCORING_MODEL ?? "claude-opus-5";
export const FEEDBACK_MODEL = process.env.FEEDBACK_MODEL ?? SCORING_MODEL;

/**
 * Effort drives thinking depth, and thinking tokens are billed as output --
 * which makes this a bigger lever on cost than the model tier is. Lower it
 * only after calibration says the scorer still agrees with real readers.
 */
export const SCORING_EFFORT = (process.env.SCORING_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";

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
