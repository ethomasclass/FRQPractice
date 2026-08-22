# FRQ Practice

A small web app for AP Human Geography: students write timed free-response
answers, peer review each other against the real rubric, and get a score plus
feedback. Built for one teacher and about 50 students a semester.

## How it works

An assignment moves through five states, and the teacher advances each one by
hand — nothing runs on a timer that could fire during a fire drill.

1. **Draft** — write the question and rubric, or have one drafted from released
   College Board material and edit it. Invisible to students.
2. **Writing** — students write against a server-side clock.
3. **Peer review** — four classmates review each response, anonymously.
4. **Grading** — the teacher settles contested points.
5. **Released** — students see their score, their feedback, and how well they
   graded other people.

### How a point is decided

Every part of the question is worth exactly one point, matching how the College
Board actually scores. For each point:

- **Peer majority decides.**
- **An even split goes to the AI**, which scored the response independently.
- **A teacher mark overrides everything.**
- **A makeup response with no peers** is scored by the AI alone.

A point is flagged **contested** when peers split evenly, or when their majority
contradicts the AI. Sorting by contested count is what turns "read fifty
responses" into "look at a dozen points."

### Why reviewers are graded against the AI, not the final score

Students are graded on their reviewing as well as their writing — their
**calibration score** is how often they agreed with the official read.

That yardstick is deliberately the AI's independent score, never the final
score. If reviewers were graded on agreeing with the peer majority, the winning
strategy would be to guess what everyone else said, and calibration would
measure conformity instead of judgment. The AI scores every response before it
sees any peer input, so it is the one independent read available. Wherever the
teacher overrules a point, their ruling replaces the AI as the yardstick and
propagates into every reviewer's grade automatically.

### The review screen

One rubric part per screen. To award a point a reviewer must **highlight the
words that earn it** and name **which acceptance criterion** it matched. To
withhold one they must pick a reason. The Next button stays locked until they do
one or the other — you cannot slide your way to 7/7.

The withholding reasons come from the Chief Reader reports, which describe the
same failures every year. "Described, didn't explain" is first for a reason.

## Running it

```bash
cp .env.example .env      # set TEACHER_PASSWORD and SESSION_SECRET
npm install
npm run db:migrate
npm run dev
```

Students go to `/`, type the class code, and pick their name. No accounts, no
passwords, no Google sign-in — most districts restrict third-party app access to
student Workspace accounts, and finding that out on a writing morning is not a
recoverable failure. Teachers sign in at `/teacher/signin` with
`TEACHER_PASSWORD`.

### Sample data

```bash
npm run db:seed              # a class, a roster, and the real 2025 Set 1 Q1 rubric
npm run db:seed:responses    # eight submitted responses of varying quality
npm run db:seed:reviews      # completes the outstanding peer reviews
```

### AI features

Set `ANTHROPIC_API_KEY` to enable independent scoring, rubric drafting, and
student feedback. Everything else — writing, peer review, peer-majority scoring,
CSV export — works without it. Where the key is missing the UI disables those
buttons rather than failing.

**Before trusting the scorer with grades, measure it.** It breaks ties on
student scores *and* is the yardstick for every reviewer's calibration, so it
carries real weight:

```bash
npm run ai:calibrate -- fixtures/calibration.json
```

Point it at responses that already have official scores — the "Sample Student
Responses and Scoring Commentary" PDFs on AP Central publish real responses
alongside the score each part received. It reports per-part agreement and, more
usefully, which direction it errs: too generous inflates grades, too harsh
punishes reviewers who were right. It exits non-zero below 90%.
`lib/ai/calibrate.ts` documents the fixture format.

It also reports what the run cost and extrapolates to a semester, so choosing a
cheaper model is a measured tradeoff. To compare two:

```bash
npm run ai:calibrate -- fixtures/calibration.json
SCORING_MODEL=claude-sonnet-5 npm run ai:calibrate -- fixtures/calibration.json
```

Scoring and feedback are configured separately (`SCORING_MODEL`,
`FEEDBACK_MODEL`) because they are different jobs: scoring decides grades and
anchors calibration, while feedback is writing. `SCORING_EFFORT` controls
thinking depth — thinking bills as output, so it moves cost more than the model
tier does.

**API usage is billed separately from any claude.ai subscription.** A Pro or Max
plan covers claude.ai and Claude Code, not a deployed app calling the API with a
key.

### Exemplars and copyright

Released College Board questions and scoring guidelines are copyrighted.
Classroom use is fine; republishing them is not. Keep them in your own database
(the `exemplars` table) or a gitignored folder — never commit them.

## Deploying

Runs on any Node host plus a hosted SQLite database (Turso). Set `DATABASE_URL`,
`DATABASE_AUTH_TOKEN`, `TEACHER_PASSWORD`, `SESSION_SECRET`, and
`ANTHROPIC_API_KEY`, then run `npm run db:migrate` against the production
database once.

At 50 students and five FRQs a semester the load is a rounding error — well
under 1% of a typical free tier's monthly allowance, per year. Two things to
know before picking a host:

- **Vercel's free Hobby plan is non-commercial only**; commercial use needs Pro.
  A teacher running this for their own class generates no revenue, but if that
  distinction matters to you, Cloudflare Workers has a free tier that permits
  commercial use and runs Next.js via `@opennextjs/cloudflare`.
- **Scoring and feedback run one response per request, driven from the browser.**
  Serverless platforms kill long requests, and scoring a class of 50 takes far
  longer than any of them allow. Each call handles one response and returns, the
  grading page loops with a progress bar, and an interrupted run resumes from
  where it stopped rather than starting over.

## Tests

```bash
npm test        # scoring rules: majorities, ties, overrides, review assignment
npm run e2e     # sign-in, peer review, and grading in a real browser
```

`npm run e2e` needs the dev server running. The scoring engine in `lib/scoring.ts`
is pure functions with no database or network, so the rules that decide student
grades are testable in isolation.
