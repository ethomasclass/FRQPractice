import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, SCORING_MODEL } from "./client";

export type ScorablePart = {
  id: string;
  label: string;
  taskVerb: string;
  promptText: string;
  graderNote: string;
  criteria: { code: string; text: string }[];
};

const PartScoreSchema = z.object({
  label: z.string().describe("The part letter, e.g. A"),
  earned: z.boolean().describe("True only if the response satisfies one of the listed acceptable responses"),
  criterionCode: z
    .string()
    .describe("The code of the acceptable response it matched, e.g. C7. Empty string when not earned."),
  quote: z
    .string()
    .describe("The exact words from the response that earn the point, copied verbatim. Empty string when not earned."),
  justification: z
    .string()
    .describe("One sentence, addressed to a teacher, explaining the decision against the rubric."),
  confidence: z.number().min(0).max(1).describe("How confident you are, 0 to 1. Be honest about borderline cases."),
});

const ScoreSchema = z.object({ parts: z.array(PartScoreSchema) });

export type PartScore = z.infer<typeof PartScoreSchema>;

/**
 * Scores one response against the rubric, part by part.
 *
 * Deliberately blind to peer scores. This read is the tiebreaker for a
 * student's grade AND the yardstick every reviewer's calibration is measured
 * against, so it has to be formed independently -- if it saw the peer votes
 * first, calibration would collapse into measuring agreement with the crowd.
 */
export async function scoreResponse(args: {
  intro: string;
  stimulusText: string;
  parts: ScorablePart[];
  responseText: string;
}): Promise<PartScore[]> {
  const { intro, stimulusText, parts, responseText } = args;

  const rubric = parts
    .map((p) => {
      const criteria = p.criteria.map((c) => `    - ${c.code}. ${c.text}`).join("\n");
      const note = p.graderNote ? `\n  Grader note: ${p.graderNote}` : "";
      return `Part ${p.label} (${p.taskVerb}) — 1 point\n  Question: ${p.promptText}${note}\n  Award the point for any ONE of these:\n${criteria}`;
    })
    .join("\n\n");

  const system = `You are an experienced AP Human Geography exam reader scoring a student's free-response answer.

Score exactly as a trained reader at the AP Reading would:

- Each part is worth exactly 1 point. There is no partial credit.
- Award the point if the response satisfies ANY ONE of the listed acceptable responses. It does not have to match the wording.
- Score only what the student wrote. Never award a point for what they seem to almost say, or for knowledge you assume they have.
- A response can earn a point anywhere in the answer, even if it is written under a different letter — but only if it genuinely answers this part's question.
- Respect the task verb. "Describe" needs characteristics; "Explain" needs a causal link — how or why. A response that only describes when the verb is Explain does NOT earn the point. This is the most common reason points are lost, and readers are strict about it.
- Do not reward length, vocabulary, or confidence. A short correct answer earns the point; a long vague one does not.
- Do not penalize spelling, grammar, or an informal tone.
- When you award a point, quote the student's exact words that earn it, copied character-for-character from the response.
- Set confidence below 0.7 when the decision is genuinely borderline. Borderline cases are surfaced to the teacher, so honest uncertainty is more useful than false precision.

Return a score for every part, in order.`;

  const stimulus = stimulusText ? `\n\nStimulus:\n${stimulusText}` : "";

  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(ScoreSchema),
    },
    messages: [
      {
        role: "user",
        content: `Question context: ${intro || "(none)"}${stimulus}

Rubric:
${rubric}

---

Student response:
${responseText || "(the student submitted nothing)"}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("AI scoring returned no parsable result.");

  // Return them in rubric order, and never invent a part the rubric doesn't have.
  return parts.map((p) => {
    const match = parsed.parts.find((s) => s.label.trim().toUpperCase() === p.label.toUpperCase());
    return (
      match ?? {
        label: p.label,
        earned: false,
        criterionCode: "",
        quote: "",
        justification: "The scorer did not return a decision for this part.",
        confidence: 0,
      }
    );
  });
}
