import { anthropic, FEEDBACK_MODEL } from "./client";

export type FeedbackPart = {
  label: string;
  taskVerb: string;
  promptText: string;
  earned: boolean;
  /** What the AI thought, in rubric terms. */
  aiJustification: string;
  /** What peers pointed at, and why they withheld the point. Anonymous. */
  peerHighlights: string[];
  peerReasons: string[];
  /** The teacher's own words, when they wrote any. Outranks everything else. */
  teacherNote: string;
  criteria: { code: string; text: string }[];
};

/**
 * Writes the one thing the student actually reads.
 *
 * Built from the settled marks plus what peers and the teacher pointed at, so
 * the feedback reflects the same evidence the score did rather than a fresh
 * opinion that might contradict it.
 */
export async function writeFeedback(args: {
  studentFirstName: string;
  title: string;
  parts: FeedbackPart[];
  responseText: string;
}): Promise<string> {
  const { studentFirstName, title, parts, responseText } = args;
  const score = parts.filter((p) => p.earned).length;

  const detail = parts
    .map((p) => {
      const lines = [
        `Part ${p.label} (${p.taskVerb}) — ${p.earned ? "EARNED" : "NOT EARNED"}`,
        `  Question: ${p.promptText}`,
        `  Rubric wanted any of: ${p.criteria.map((c) => c.text).join(" | ")}`,
      ];
      if (p.aiJustification) lines.push(`  Scorer's reasoning: ${p.aiJustification}`);
      if (p.peerReasons.length) lines.push(`  Reviewers who withheld it said: ${p.peerReasons.join("; ")}`);
      if (p.peerHighlights.length) {
        lines.push(`  Reviewers pointed at: ${p.peerHighlights.map((h) => `"${h}"`).join(" / ")}`);
      }
      if (p.teacherNote) lines.push(`  TEACHER'S NOTE (authoritative, use their point): ${p.teacherNote}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const system = `You write feedback for a high school AP Human Geography student on a practice free-response question.

Write to the student, using their first name once at the start. Warm, direct, specific. The tone of a teacher who has read a hundred of these and wants this one to get better — not a report card, not a cheerleader.

Rules:
- Ground every claim in what they actually wrote. Quote their words when you praise or correct something.
- Lead with what earned points and why it worked, so they can repeat it.
- For each point they missed, say concretely what would have earned it. "Add why this happens" beats "be more detailed."
- If the same weakness shows up in several parts, name the pattern once instead of repeating it part by part. That single observation is usually the most useful thing in the whole page.
- When a teacher's note is present, its judgment is final. Reflect their point in your own words; never contradict it.
- Never mention how many reviewers agreed, that peers reviewed this, or that any of this was automated. Never name or hint at who reviewed them.
- Do not restate the rubric wholesale or lecture about the exam.
- 150-250 words. Plain paragraphs and short bolded part labels are fine; no headers, no bullet-point walls.
- End with one specific thing to do on the next FRQ.`;

  const message = await anthropic().messages.create({
    model: FEEDBACK_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Student first name: ${studentFirstName}
Question: ${title}
Final score: ${score} out of ${parts.length}

Their response:
${responseText || "(they submitted nothing)"}

Point-by-point record:
${detail}`,
      },
    ],
  });

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
