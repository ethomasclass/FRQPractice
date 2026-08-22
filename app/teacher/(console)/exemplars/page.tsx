import { listExemplars } from "@/app/actions/exemplars";
import { aiConfigured } from "@/lib/ai/client";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ExemplarLibrary } from "./library";

export default async function ExemplarsPage() {
  const rows = await listExemplars();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <PageHeader
        title="Exemplars"
        description="Released College Board questions and scoring guidelines. Drafting a rubric copies their structure and specificity, which is the difference between something that sounds like a rubric and something that reads like one."
      />

      {!aiConfigured() ? (
        <Card className="mb-6 border-accent-border bg-accent-soft p-4">
          <p className="text-sm text-foreground">
            Drafting needs <code className="text-xs">ANTHROPIC_API_KEY</code> set. You can still store exemplars here —
            they&apos;re also the source for the scorer&apos;s calibration set.
          </p>
        </Card>
      ) : null}

      <Card className="mb-6 p-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">Where to get these:</span> apcentral.collegeboard.org → AP Human
          Geography → past exam questions. Open a scoring guideline PDF, select all, and paste the text below. The
          &ldquo;Sample Student Responses and Scoring Commentary&rdquo; PDFs are the most valuable — they show real
          responses alongside the reader&apos;s reasoning.
        </p>
        <p className="mt-2 text-sm text-muted">
          This material is copyrighted. It lives in your database and is never committed to the repository or shared
          outside your classes.
        </p>
      </Card>

      <ExemplarLibrary rows={rows} />

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No exemplars yet"
            description="Two or three scoring guidelines is enough for drafting to pick up the house style."
          />
        </div>
      ) : null}
    </main>
  );
}
