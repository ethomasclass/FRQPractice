import type { AssignmentStatus, NotEarnedReason, TaskVerb } from "@/lib/db/schema";

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  draft: "Draft",
  writing: "Writing open",
  reviewing: "Peer review",
  adjudicating: "Ready to grade",
  released: "Released",
};

export const STATUS_BLURB: Record<AssignmentStatus, string> = {
  draft: "Only you can see this. Students see nothing until you open writing.",
  writing: "Students can write. Nobody can review yet.",
  reviewing: "Writing is closed. Students are reviewing each other.",
  adjudicating: "Reviews are in. Settle the contested points, then release.",
  released: "Students can see their scores and feedback.",
};

/**
 * Withholding reasons, taken from what Chief Reader reports describe year after
 * year. Naming the failure is most of the instruction: a student who has picked
 * "described instead of explained" four times starts to hear the difference.
 */
export const NOT_EARNED_REASONS: { value: NotEarnedReason; label: string; help: string }[] = [
  {
    value: "described_not_explained",
    label: "Described, didn't explain",
    help: "States what happens but never says how or why it happens.",
  },
  {
    value: "no_geographic_reasoning",
    label: "No geographic reasoning",
    help: "True, but could have been written without the course. No spatial or scalar thinking.",
  },
  {
    value: "restates_prompt",
    label: "Restates the prompt",
    help: "Rewords the question instead of answering it.",
  },
  {
    value: "too_vague",
    label: "Too vague to score",
    help: "Gestures at the right area without committing to a claim a reader could accept.",
  },
  {
    value: "wrong_concept",
    label: "Wrong concept",
    help: "Confidently answers using the wrong idea.",
  },
  {
    value: "answers_different_part",
    label: "Answers a different part",
    help: "Good content, but it belongs to another letter of this question.",
  },
  {
    value: "not_addressed",
    label: "Not addressed at all",
    help: "Nothing in the response attempts this part.",
  },
];

export const REASON_LABELS = Object.fromEntries(
  NOT_EARNED_REASONS.map((r) => [r.value, r.label]),
) as Record<NotEarnedReason, string>;

/** What the task verb actually demands — shown to reviewers at the moment of judging. */
export const VERB_DEMAND: Record<TaskVerb, string> = {
  Define: "Give the meaning of the term. No example required, but it must be correct and complete.",
  Identify: "Name it. A correct name is enough; no elaboration required.",
  Describe: "Give the characteristics of it. More than naming, but no causal link required.",
  Explain: "Say how or why. A cause-and-effect link is required — this is where most points are lost.",
  Compare: "State similarities and/or differences explicitly, not one after the other.",
};
