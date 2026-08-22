import { notFound } from "next/navigation";
import { loadAssignment, unsubmittedStudents } from "@/app/actions/teacher";
import { listExemplars } from "@/app/actions/exemplars";
import { aiConfigured } from "@/lib/ai/client";
import { STATUS_BLURB, STATUS_LABELS } from "@/lib/labels";
import { Badge, Card, PageHeader } from "@/components/ui";
import { LifecycleButtons } from "../../lifecycle-buttons";
import { RubricEditor } from "./rubric-editor";

/** Drafting a full rubric runs the model for a while; 10 seconds is not enough. */
export const maxDuration = 60;

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAssignment(id);
  if (!data) notFound();

  const missing = await unsubmittedStudents(id);
  const exemplars = await listExemplars();
  const submitted = data.responses.filter((r) => r.submittedAt).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow={data.section?.name}
        title={data.assignment.title}
        description={STATUS_BLURB[data.assignment.status]}
        actions={
          <LifecycleButtons id={id} status={data.assignment.status} submittedCount={submitted} />
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-subtle">Status</p>
          <p className="mt-1 font-medium text-foreground">{STATUS_LABELS[data.assignment.status]}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-subtle">Submitted</p>
          <p className="mt-1 font-medium text-foreground">
            {submitted} of {data.roster.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-subtle">Reviews finished</p>
          <p className="mt-1 font-medium text-foreground">
            {data.reviewProgress.complete} of {data.reviewProgress.total}
          </p>
        </Card>
      </div>

      {data.assignment.status !== "draft" && missing.length > 0 ? (
        <Card className="mb-8 p-5">
          <h2 className="mb-1 font-medium text-foreground">Hasn&apos;t submitted ({missing.length})</h2>
          <p className="mb-3 text-sm text-muted">
            These students are skipped when reviews are handed out. If they write it later, they&apos;re scored by AI
            alone — no classmates are kept waiting.
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map((s) => (
              <Badge key={s.id} tone="neutral">
                {s.name}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <RubricEditor
        assignmentId={id}
        locked={data.assignment.status !== "draft"}
        exemplars={exemplars.map((e) => ({ id: e.id, title: e.title }))}
        aiReady={aiConfigured()}
        initialParts={data.parts.map((p) => ({
          label: p.label,
          taskVerb: p.taskVerb,
          promptText: p.promptText,
          graderNote: p.graderNote,
          criteria: p.criteria.map((c) => ({ code: c.code, text: c.text })),
        }))}
      />
    </main>
  );
}
