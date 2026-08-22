# Calibration fixtures

Fixtures pair real student responses with the score each part actually
received, so the AI scorer can be measured against real AP readers before it is
trusted with anyone's grade.

**The JSON files here are gitignored on purpose.** They contain College Board
text — released questions, scoring guidelines, and student responses — which is
copyrighted. Classroom use is fine; committing it to a public repository is not.
Build your own copy locally with the steps below.

## Building one

The source is the "Sample Student Responses and Scoring Commentary" PDFs on
AP Central (one per question, per set). They are the only public documents that
publish a real response alongside the score each individual part received.

```bash
# 1. Convert the PDFs to text (poppler: brew install poppler / apt install poppler-utils)
pdftotext -layout ap25-apc-human-geography-q1-set-1.pdf q1set1.txt
pdftotext -layout ap25-apc-human-geography-q1-set-2.pdf q1set2.txt

# 2. Build the fixture
npm run ai:fixture -- fixtures/calibration.json q1set1.txt q1set2.txt

# 3. Measure the scorer
npm run ai:calibrate -- fixtures/calibration.json
```

The builder reads the rubric, the responses, and the per-part scores straight
out of the commentary PDF, and warns if a question does not parse into seven
parts.

## Stimulus questions

Questions 2 and 3 show a chart or map. That image is not in the extracted text,
so the builder flags them `"needsStimulus": true` and the harness **skips** them
rather than scoring a question the model cannot see — otherwise you would be
measuring the scorer on data it was never shown.

To include them, describe the stimulus in that question's `stimulusText` field:

```json
"stimulusText": "Population pyramid for Japan, 2021. Ages 0-4 through 100+ in
five-year cohorts, males left and females right, as a percentage of total
population. The 0-4 cohort is about 2% per side; the 45-54 cohorts are the
widest at roughly 4% per side; above age 80 females reach 6-7% while males are
3-4%."
```

Q1 needs no stimulus and works immediately.

## What good looks like

The harness reports agreement and, more usefully, which direction it errs.
**Too generous** inflates every student's grade. **Too harsh** punishes
reviewers who were right, because reviewer calibration is measured against this
same score. It exits non-zero below 90% agreement.

Run it again after any change to the scoring prompt, the model, or the effort
level — all three move the result.
