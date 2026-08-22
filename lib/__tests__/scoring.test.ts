import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { assignReviews, computeCalibration, settleMark, yardstickFor } from "../scoring";

const peers = (...votes: boolean[]) => votes.map((earned, i) => ({ reviewerId: `r${i}`, earned }));

/** A scorer that agreed with real readers 29 times out of 29 at this confidence. */
const confidentAi = (earned: boolean) => ({ earned, confidence: 0.95 });
/** Below the floor, where measured agreement was close to a coin flip. */
const shakyAi = (earned: boolean) => ({ earned, confidence: 0.6 });

describe("settleMark", () => {
  test("a clear peer majority decides the point", () => {
    const m = settleMark({ peers: peers(true, true, true, false), ai: confidentAi(true), teacher: null });
    assert.equal(m.earned, true);
    assert.equal(m.source, "peer_majority");
    assert.equal(m.contested, false);
    assert.equal(m.peerEarnedCount, 3);
    assert.equal(m.peerTotalCount, 4);
  });

  test("an even split is broken by the AI and flagged for the teacher", () => {
    const m = settleMark({ peers: peers(true, true, false, false), ai: confidentAi(false), teacher: null });
    assert.equal(m.earned, false);
    assert.equal(m.source, "ai_tiebreak");
    assert.equal(m.contested, true);
  });

  test("a majority that contradicts the AI is contested even though peers win", () => {
    const m = settleMark({ peers: peers(true, true, true, false), ai: confidentAi(false), teacher: null });
    assert.equal(m.earned, true, "peers still decide");
    assert.equal(m.source, "peer_majority");
    assert.equal(m.contested, true, "but the teacher should look");
  });

  test("a teacher mark overrides peers and AI and clears the flag", () => {
    const m = settleMark({ peers: peers(true, true, true, true), ai: confidentAi(true), teacher: { earned: false } });
    assert.equal(m.earned, false);
    assert.equal(m.source, "teacher");
    assert.equal(m.contested, false);
  });

  test("a makeup response with no peers falls through to the AI alone", () => {
    const m = settleMark({ peers: [], ai: confidentAi(true), teacher: null });
    assert.equal(m.earned, true);
    assert.equal(m.source, "ai_only");
    assert.equal(m.contested, false);
  });

  test("no peers and no AI does not award a point by accident", () => {
    const m = settleMark({ peers: [], ai: null, teacher: null });
    assert.equal(m.earned, false);
  });

  test("an odd number of reviewers can never tie", () => {
    const m = settleMark({ peers: peers(true, false, false), ai: confidentAi(true), teacher: null });
    assert.equal(m.source, "peer_majority");
    assert.equal(m.earned, false);
  });

  test("a single reviewer is a majority of one", () => {
    const m = settleMark({ peers: peers(true), ai: confidentAi(true), teacher: null });
    assert.equal(m.earned, true);
    assert.equal(m.source, "peer_majority");
  });
});

describe("computeCalibration", () => {
  test("scores a reviewer against the independent AI read", () => {
    const c = computeCalibration({
      reviewerId: "r1",
      judgements: [
        { earned: true, yardstick: { earned: true } },
        { earned: false, yardstick: { earned: false } },
        { earned: true, yardstick: { earned: false } },
        { earned: true, yardstick: { earned: true } },
      ],
      reviewsAssigned: 4,
      reviewsCompleted: 4,
    });
    assert.equal(c.pointsAgreed, 3);
    assert.equal(c.pointsJudged, 4);
    assert.equal(c.accuracy, 0.75);
  });

  test("points with no independent read are not held against the reviewer", () => {
    const c = computeCalibration({
      reviewerId: "r1",
      judgements: [
        { earned: true, yardstick: { earned: true } },
        { earned: true, yardstick: null },
      ],
      reviewsAssigned: 1,
      reviewsCompleted: 1,
    });
    assert.equal(c.pointsJudged, 1);
    assert.equal(c.accuracy, 1);
  });

  test("a reviewer who judged nothing has no accuracy rather than a zero", () => {
    const c = computeCalibration({ reviewerId: "r1", judgements: [], reviewsAssigned: 3, reviewsCompleted: 0 });
    assert.equal(c.accuracy, null);
    assert.equal(c.reviewsCompleted, 0);
  });

  test("a reviewer is not rewarded for agreeing with a peer majority the teacher overruled", () => {
    // Four peers all said earned; the teacher said not earned. Calibration must
    // follow the teacher, not the crowd -- this is the anti-conformity property.
    const c = computeCalibration({
      reviewerId: "r1",
      judgements: [{ earned: true, yardstick: { earned: false } }],
      reviewsAssigned: 1,
      reviewsCompleted: 1,
    });
    assert.equal(c.accuracy, 0);
  });
});

describe("assignReviews", () => {
  const build = (n: number, reviewsPerResponse = 4) => {
    const students = Array.from({ length: n }, (_, i) => `s${i}`);
    return assignReviews({
      responses: students.map((studentId) => ({ responseId: `resp-${studentId}`, studentId })),
      reviewerIds: students,
      reviewsPerResponse,
    });
  };

  test("gives every response the requested number of reviewers", () => {
    const pairs = build(20);
    const perResponse = new Map<string, number>();
    for (const p of pairs) perResponse.set(p.responseId, (perResponse.get(p.responseId) ?? 0) + 1);
    assert.equal(perResponse.size, 20);
    for (const count of perResponse.values()) assert.equal(count, 4);
  });

  test("nobody reviews their own response", () => {
    for (const p of build(20)) assert.notEqual(p.responseId, `resp-${p.reviewerId}`);
  });

  test("spreads the load evenly so no student gets a pile", () => {
    const pairs = build(20);
    const perReviewer = new Map<string, number>();
    for (const p of pairs) perReviewer.set(p.reviewerId, (perReviewer.get(p.reviewerId) ?? 0) + 1);
    const loads = [...perReviewer.values()];
    assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, `load spread too wide: ${loads.join(",")}`);
  });

  test("absent students simply are not in the pool", () => {
    // 20 on the roster, only 12 wrote. The other 8 have nothing to be reviewed.
    const students = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const submitted = students.slice(0, 12);
    const pairs = assignReviews({
      responses: submitted.map((studentId) => ({ responseId: `resp-${studentId}`, studentId })),
      reviewerIds: students,
      reviewsPerResponse: 4,
    });
    const reviewed = new Set(pairs.map((p) => p.responseId));
    assert.equal(reviewed.size, 12);
  });

  test("a tiny class cannot be asked for more reviewers than exist", () => {
    const pairs = build(3, 4);
    const perResponse = new Map<string, number>();
    for (const p of pairs) perResponse.set(p.responseId, (perResponse.get(p.responseId) ?? 0) + 1);
    for (const count of perResponse.values()) assert.equal(count, 2, "3 students means at most 2 other reviewers");
  });

  test("a single response has nobody to review it in a class of one", () => {
    assert.deepEqual(build(1), []);
  });

  test("each reviewer's queue is numbered from one so responses stay anonymous", () => {
    const pairs = build(20);
    const byReviewer = new Map<string, number[]>();
    for (const p of pairs) byReviewer.set(p.reviewerId, [...(byReviewer.get(p.reviewerId) ?? []), p.displayIndex]);
    for (const indexes of byReviewer.values()) {
      assert.deepEqual([...indexes].sort((a, b) => a - b), indexes.map((_, i) => i + 1));
    }
  });
});

describe("low-confidence AI marks", () => {
  test("a shaky AI deciding a makeup response flags it for the teacher", () => {
    const m = settleMark({ peers: [], ai: shakyAi(true), teacher: null });
    assert.equal(m.source, "ai_only");
    assert.equal(m.contested, true, "nobody else will catch this one");
  });

  test("a confident AI deciding a makeup response does not need a second look", () => {
    const m = settleMark({ peers: [], ai: confidentAi(true), teacher: null });
    assert.equal(m.contested, false);
  });

  test("a makeup response with no AI at all is flagged rather than silently zeroed", () => {
    const m = settleMark({ peers: [], ai: null, teacher: null });
    assert.equal(m.earned, false);
    assert.equal(m.contested, true);
  });

  test("a shaky AI is not used to grade reviewers", () => {
    assert.equal(yardstickFor({ ai: shakyAi(true), teacher: null }), null);
  });

  test("a confident AI is used to grade reviewers", () => {
    assert.deepEqual(yardstickFor({ ai: confidentAi(true), teacher: null }), { earned: true });
  });

  test("a teacher ruling outranks a shaky AI and restores the yardstick", () => {
    assert.deepEqual(yardstickFor({ ai: shakyAi(true), teacher: { earned: false } }), { earned: false });
  });

  test("a reviewer is not marked wrong on a point the scorer itself was unsure about", () => {
    const c = computeCalibration({
      reviewerId: "r1",
      judgements: [
        { earned: true, yardstick: yardstickFor({ ai: confidentAi(true), teacher: null }) },
        { earned: false, yardstick: yardstickFor({ ai: shakyAi(true), teacher: null }) },
      ],
      reviewsAssigned: 1,
      reviewsCompleted: 1,
    });
    assert.equal(c.pointsJudged, 1, "the shaky point is dropped, not counted against them");
    assert.equal(c.accuracy, 1);
  });
});
