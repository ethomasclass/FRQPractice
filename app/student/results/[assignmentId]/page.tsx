import Link from "next/link";
import { notFound } from "next/navigation";
import { studentResults } from "@/app/actions/results";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function ResultsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const data = await studentResults(assignmentId);
  if (!data) notFound();

  const pct = data.outOf ? Math.round((data.score / data.outOf) * 100) : 0;
  const calAccuracy =
    data.calibration && data.calibration.pointsJudged
      ? Math.round((data.calibration.pointsAgreed / data.calibration.pointsJudged) * 100)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow="Results"
        title={data.title}
        actions={
          <Link href="/student" className="text-sm text-subtle underline underline-offset-4 hover:text-foreground">
            Back
          </Link>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-subtle">Your score</p>
          <p className="mt-1 text-4xl font-semibold text-foreground">
            {data.score}
            <span className="text-2xl text-subtle">/{data.outOf}</span>
          </p>
          <p className="mt-1 text-sm text-muted">{pct}%</p>
        </div>
        <div className="flex gap-1.5">
          {data.parts.map((p) => (
            <span
              key={p.label}
              title={`${p.label}: ${p.earned ? "earned" : "not earned"}`}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold ${
                p.earned ? "bg-earned-soft text-earned" : "bg-surface-sunken text-subtle"
              }`}
            >
              {p.label}
            </span>
          ))}
        </div>
        {data.isMakeup ? <Badge tone="accent">Makeup — scored without peer review</Badge> : null}
      </Card>

      {data.feedback ? (
        <Card className="mb-6 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">Feedback</h2>
          <div className="prose-response text-foreground">{data.feedback}</div>
        </Card>
      ) : null}

      <Card className="mb-6">
        <div className="border-b border-border-subtle px-6 py-4">
          <h2 className="font-medium text-foreground">Point by point</h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {data.parts.map((p) => (
            <li key={p.label} className="px-6 py-4">
              <div className="mb-2 flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    p.earned ? "bg-earned-soft text-earned" : "bg-surface-sunken text-subtle"
                  }`}
                >
                  {p.label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.promptText}</p>
                  <p className="text-xs text-subtle">
                    {p.taskVerb} · {p.earned ? "Point earned" : "No point"}
                  </p>
                </div>
              </div>
              {!p.earned ? (
                <details className="ml-10">
                  <summary className="cursor-pointer text-xs text-brand">What would have earned it</summary>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted">
                    {p.criteria.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {data.calibration ? (
        <Card className="p-6">
          <h2 className="mb-1 font-medium text-foreground">How you graded others</h2>
          <p className="mb-3 text-sm text-muted">
            Reading someone else&apos;s answer against the rubric is the fastest way to learn what a grader wants. This
            is the part of the assignment where you were the reader.
          </p>
          {calAccuracy == null ? (
            <p className="text-sm text-subtle">
              You finished {data.calibration.reviewsCompleted} of {data.calibration.reviewsAssigned} reviews.
            </p>
          ) : (
            <p className="text-sm text-foreground">
              You agreed with the official score on{" "}
              <span className="font-semibold">
                {data.calibration.pointsAgreed} of {data.calibration.pointsJudged}
              </span>{" "}
              points — <span className="font-semibold">{calAccuracy}%</span> — across{" "}
              {data.calibration.reviewsCompleted} reviews.
            </p>
          )}
        </Card>
      ) : null}
    </main>
  );
}
