import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, SCORING_MODEL } from "./client";

const DraftSchema = z.object({
  title: z.string().describe("A short title for the teacher's list, not shown as part of the question."),
  intro: z
    .string()
    .describe("The one- or two-sentence scene-setter above the parts. Empty string if the question needs none."),
  parts: z.array(
    z.object({
      label: z.string().describe("A, B, C, ... in order"),
      taskVerb: z.enum(["Define", "Identify", "Describe", "Explain", "Compare"]),
      promptText: z.string().describe("The question for this part, phrased exactly as it would appear on the exam."),
      criteria: z.array(
        z.object({
          code: z.string().describe("Letter plus number, e.g. C3"),
          text: z.string().describe("One acceptable response a reader would award the point for."),
        }),
      ),
    }),
  ),
});

export type RubricDraft = z.infer<typeof DraftSchema>;

/**
 * Drafts a question and its rubric in the shape of a released scoring
 * guideline. The result is always a draft: it lands in the editor for the
 * teacher to fix before anything goes live, because a sloppy rubric silently
 * corrupts peer scoring, AI scoring, and calibration all at once.
 */
export async function draftRubric(args: {
  topic: string;
  partCount: number;
  /** Released scoring guidelines pasted in by the teacher, used as style exemplars. */
  exemplars: string[];
  notes?: string;
}): Promise<RubricDraft> {
  const { topic, partCount, exemplars, notes } = args;

  const system = `You write AP Human Geography free-response questions and their scoring guidelines, in the exact style College Board uses.

Structure, which is not negotiable:
- Exactly ${partCount} parts, labeled A, B, C, ... Each part is worth exactly 1 point.
- Parts get harder in order. Early parts use Define, Identify, or Describe; later parts use Explain. This mirrors how real questions are built.
- Each part's question is a single sentence beginning with its task verb.
- Under each part, list the acceptable responses a reader would award the point for — typically 2 to 6, more for parts with many valid answers. Code them by letter and number (A1, A2, B1, ...).
- Each acceptable response is a complete, self-contained statement a reader can hold an answer against. Not a topic, not a keyword list.
- For Explain parts, every acceptable response must contain the causal link — the how or why. This is what separates a real scoring guideline from a study guide, and it is what your acceptable responses will be judged on.
- Stay inside the AP Human Geography course scope. Use course vocabulary.
- Do not write acceptable responses that overlap so heavily a reader could not tell them apart.`;

  const exemplarBlock = exemplars.length
    ? `Here are released scoring guidelines to match in structure, specificity, and tone:\n\n${exemplars.join("\n\n---\n\n")}`
    : "No exemplars were provided. Follow the structure described above.";

  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(DraftSchema) },
    messages: [
      {
        role: "user",
        content: `${exemplarBlock}

---

Write a new ${partCount}-point question on: ${topic}
${notes ? `\nAdditional direction from the teacher: ${notes}` : ""}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The rubric generator returned no parsable result.");
  return parsed;
}
