import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, SCORING_EFFORT, SCORING_MODEL } from "./client";

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

export type ScoreUsage = {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  model: string;
};

export type ScoreResult = { parts: PartScore[]; usage: ScoreUsage };

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
}): Promise<ScoreResult> {
  const { intro, stimulusText, parts, responseText } = args;

  const rubric = parts
    .map((p) => {
      const criteria = p.criteria.map((c) => `    - ${c.code}. ${c.text}`).join("\n");
      const note = p.graderNote ? `\n  Grader note: ${p.graderNote}` : "";
      return `Part ${p.label} (${p.taskVerb}) — 1 point\n  Question: ${p.promptText}${note}\n  Award the point for any ONE of these:\n${criteria}`;
    })
    .join("\n\n");

  const system = `You are an experienced AP Human Geography exam reader scoring a student's free-response answer.

Each part is worth exactly 1 point. There is no partial credit.

THE DEFAULT IS NOT EARNED. The student has to earn the point; you do not award it because an answer is pointed in the right direction.

The failure mode you must avoid is generosity. Trained readers withhold points from answers that gesture at the right idea without ever stating it. You will be tempted to reconstruct what a student probably meant, to supply the causal link they left out, or to treat a relevant keyword as if it were an argument. Do not. Score the words in front of you, not the answer they were reaching for.

Concretely:

- Naming a relevant concept is not the same as using it. "Supranational organizations help countries and the environment" names the territory of B1 without describing a purpose. Not earned.
- An effect without a mechanism is not an explanation. On an Explain part, the response must say HOW or WHY. "Communication technology lets people riot or revolt" states an outcome; it never says how that touches state sovereignty. Not earned. "...which pressures the government to change policy" states the mechanism. Earned.
- Restating the prompt in the student's own words is not an answer.
- A vague sentence does not become correct because a generous reader could map it onto a criterion. If the criterion is doing the work rather than the response, it is not earned.
- Do not average across the response. A strong sentence elsewhere does not rescue a weak part.
- The listed acceptable responses are the complete set of what earns this point. If the student's idea is not substantially one of them, it does not earn the point, however sensible the idea is. You are matching against a list, not judging whether the student said something true.

Apply this test before awarding any point: could you quote the student's own words, without paraphrasing or adding anything, and have that quote satisfy the criterion on its own? If not, the point is not earned.

Watch your own justification as you write it. If it contains a hedge — "though vague", "albeit minimal", "loosely matches", "can be read as", "borderline", "thin", "implies", "seems to" — you have already found the answer, and the answer is NOT EARNED. Rewrite the mark, not the hedge.

Also true, and equally binding:

- Award the point when the response satisfies ANY ONE of the listed acceptable responses. It does not have to match the wording, and it does not have to be elegant. A blunt, correct sentence earns the point.
- A response may earn a point anywhere in the answer, even under a different letter, if it genuinely answers this part's question.
- Do not reward length, vocabulary, or confidence. Do not penalize spelling, grammar, or an informal tone.
- Respect the task verb. Define needs the meaning. Describe needs characteristics. Explain needs a causal link. Compare needs an explicit similarity or difference.

When you award a point, quote the student's exact words that earn it, copied character-for-character.

Set confidence below 0.7 only when a genuinely well-formed answer sits between two criteria. Uncertainty that comes from the response being vague is not a borderline case — that is a NOT EARNED, scored with confidence.

Return a score for every part, in order.`;

  const stimulus = stimulusText ? `\n\nStimulus:\n${stimulusText}` : "";

  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: {
      effort: SCORING_EFFORT,
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
  const scored = parts.map((p) => {
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

  return {
    parts: scored,
    usage: {
      inputTokens: response.usage.input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      // Thinking tokens are billed here too, which is why effort moves cost
      // more than the model tier does.
      outputTokens: response.usage.output_tokens,
      model: SCORING_MODEL,
    },
  };
}
