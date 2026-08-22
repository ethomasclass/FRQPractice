import type { MarkSource } from "@/lib/db/schema";

export type PeerVerdict = { reviewerId: string; earned: boolean };
export type Yardstick = { earned: boolean } | null;

/**
 * How confident a model has to be before its judgment decides a point on its
 * own or is used to grade a reviewer.
 *
 * This is a property of the model, not a universal constant, and it is
 * measured rather than guessed. Against 42 points from released College Board
 * sample responses with official reader scores:
 *
 *   claude-opus-5    100% at >=0.85,  56% at 0.7-0.85,  25% below 0.7
 *   claude-sonnet-5   96% at >=0.85, 100% at 0.7-0.85,  50% below 0.7
 *   claude-haiku-4-5  80% at >=0.85 -- and it claimed >=0.85 on 40 of 42
 *
 * Haiku has no usable floor: it is confidently wrong, which is the one failure
 * this design cannot absorb. The whole system leans on the scorer knowing when
 * it is guessing, so a model without calibrated confidence is disqualified
 * however cheap it is.
 *
 * An unmeasured model gets a floor of 1, which effectively routes every point
 * it decides to the teacher. That is deliberate: a new model should have to
 * earn trust through `npm run ai:calibrate`, not inherit it.
 */
const MEASURED_FLOORS: Record<string, number> = {
  "claude-opus-5": 0.85,
  "claude-sonnet-5": 0.7,
};

/** Conservative until calibration says otherwise. */
export const UNMEASURED_FLOOR = 1;

export function confidenceFloorFor(model: string): number {
  return MEASURED_FLOORS[model] ?? UNMEASURED_FLOOR;
}

export type AiMark = { earned: boolean; confidence: number; model: string } | null;

export type SettledMark = {
  earned: boolean;
  source: MarkSource;
  /** Worth the teacher's attention: peers split evenly, or they disagreed with the AI. */
  contested: boolean;
  peerEarnedCount: number;
  peerTotalCount: number;
};

/**
 * Settles one rubric point.
 *
 * Peer majority decides, the AI breaks ties, and a teacher mark overrides
 * everything. A makeup response with no peers falls through to the AI alone.
 */
export function settleMark(args: {
  peers: PeerVerdict[];
  ai: AiMark;
  teacher: { earned: boolean } | null;
}): SettledMark {
  const { peers, ai, teacher } = args;
  const peerTotalCount = peers.length;
  const peerEarnedCount = peers.filter((p) => p.earned).length;
  const base = { peerEarnedCount, peerTotalCount };

  // The teacher has looked at it. Nothing outranks that, and it is no longer contested.
  if (teacher) return { ...base, earned: teacher.earned, source: "teacher", contested: false };

  const aiIsShaky = ai != null && ai.confidence < confidenceFloorFor(ai.model);

  if (peerTotalCount === 0) {
    // Makeup work, or nobody completed their review in time. The AI stands
    // alone -- so if it is unsure, nothing else is going to catch that.
    return { ...base, earned: ai?.earned ?? false, source: "ai_only", contested: ai == null || aiIsShaky };
  }

  const forEarned = peerEarnedCount * 2;
  const isTie = forEarned === peerTotalCount;

  if (isTie) {
    // A dead-even split is exactly the case the AI exists to settle.
    return { ...base, earned: ai?.earned ?? false, source: "ai_tiebreak", contested: true };
  }

  const majority = forEarned > peerTotalCount;
  return {
    ...base,
    earned: majority,
    source: "peer_majority",
    // A lopsided split that matches the AI needs no second look. A majority that
    // contradicts the AI is the interesting case.
    contested: ai != null && ai.earned !== majority,
  };
}

/**
 * What a reviewer is measured against.
 *
 * Deliberately NOT the final score. If reviewers were graded on agreeing with
 * the peer majority, the winning strategy would be to guess what everyone else
 * said, and calibration would measure conformity instead of judgment. The AI
 * scores every response before it sees any peer input, so it is the one
 * independent read available. Where the teacher has ruled, that ruling replaces
 * the AI and their judgment propagates into every reviewer's grade.
 *
 * A low-confidence AI mark is no yardstick at all. Calibration measured it at
 * roughly a coin flip below the model's floor, and marking a student wrong for
 * disagreeing with a coin flip is not a grade -- it is noise with a percentage
 * attached. Those points are dropped from calibration unless the teacher has
 * ruled on them.
 */
export function yardstickFor(args: {
  ai: AiMark;
  teacher: { earned: boolean } | null;
}): Yardstick {
  if (args.teacher) return args.teacher;
  if (!args.ai || args.ai.confidence < confidenceFloorFor(args.ai.model)) return null;
  return { earned: args.ai.earned };
}

export type CalibrationInput = {
  reviewerId: string;
  /** One entry per rubric point the reviewer judged. */
  judgements: { earned: boolean; yardstick: Yardstick }[];
  reviewsAssigned: number;
  reviewsCompleted: number;
};

export type CalibrationResult = {
  reviewerId: string;
  pointsAgreed: number;
  pointsJudged: number;
  reviewsAssigned: number;
  reviewsCompleted: number;
  /** 0–1, or null when there was nothing to measure against. */
  accuracy: number | null;
};

export function computeCalibration(input: CalibrationInput): CalibrationResult {
  let pointsAgreed = 0;
  let pointsJudged = 0;

  for (const j of input.judgements) {
    // A point with no independent read can't be scored either way; skip it
    // rather than counting it against the reviewer.
    if (!j.yardstick) continue;
    pointsJudged += 1;
    if (j.earned === j.yardstick.earned) pointsAgreed += 1;
  }

  return {
    reviewerId: input.reviewerId,
    pointsAgreed,
    pointsJudged,
    reviewsAssigned: input.reviewsAssigned,
    reviewsCompleted: input.reviewsCompleted,
    accuracy: pointsJudged === 0 ? null : pointsAgreed / pointsJudged,
  };
}

export function scoreFromMarks(marks: { earned: boolean }[]): number {
  return marks.filter((m) => m.earned).length;
}

/**
 * Round-robin review assignment.
 *
 * Each response is reviewed by the next `reviewsPerResponse` students in a
 * rotation, which guarantees every reviewer gets a near-equal load and nobody
 * reviews themselves. Absent students simply aren't in `responseIds`, so they
 * drop out of the rotation without any special-casing -- which is what makes
 * "just skip them" work.
 */
export function assignReviews(args: {
  responses: { responseId: string; studentId: string }[];
  reviewerIds: string[];
  reviewsPerResponse: number;
}): { responseId: string; reviewerId: string; displayIndex: number }[] {
  const { responses, reviewerIds, reviewsPerResponse } = args;
  const out: { responseId: string; reviewerId: string; displayIndex: number }[] = [];
  if (responses.length === 0 || reviewerIds.length < 2) return out;

  // Can't give a response more reviewers than there are other students.
  const perResponse = Math.min(reviewsPerResponse, reviewerIds.length - 1);
  const counts = new Map<string, number>(reviewerIds.map((id) => [id, 0]));
  const perReviewerIndex = new Map<string, number>(reviewerIds.map((id) => [id, 0]));

  for (const response of responses) {
    const eligible = reviewerIds
      .filter((id) => id !== response.studentId)
      // Least-loaded first, so late submissions don't all land on one student.
      .sort((a, b) => (counts.get(a)! - counts.get(b)!) || a.localeCompare(b));

    for (const reviewerId of eligible.slice(0, perResponse)) {
      const displayIndex = perReviewerIndex.get(reviewerId)! + 1;
      perReviewerIndex.set(reviewerId, displayIndex);
      counts.set(reviewerId, counts.get(reviewerId)! + 1);
      out.push({ responseId: response.responseId, reviewerId, displayIndex });
    }
  }

  return out;
}
