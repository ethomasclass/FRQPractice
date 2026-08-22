import { listAssignments, listSections } from "@/app/actions/teacher";
import { STATUS_BLURB, STATUS_LABELS } from "@/lib/labels";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { LifecycleButtons } from "./lifecycle-buttons";

const STATUS_TONE = {
  draft: "neutral",
  writing: "brand",
  reviewing: "accent",
  adjudicating: "contested",
  released: "earned",
} as const;

export default async function TeacherDashboard() {
  const [rows, sections] = await Promise.all([listAssignments(), listSections()]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <PageHeader
        title="Assignments"
        description="Each FRQ moves through writing, peer review, and grading. You advance it when your class is ready — nothing runs on a timer that could fire during a fire drill."
        actions={
          sections.length > 0 ? <ButtonLink href="/teacher/assignments/new">New FRQ</ButtonLink> : null
        }
      />

      {sections.length === 0 ? (
        <EmptyState
          title="Add a class first"
          description="Create a class and paste in your roster. Students sign in with the class code — no accounts, no IT ticket."
          action={<ButtonLink href="/teacher/classes">Add a class</ButtonLink>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No FRQs yet"
          description="Write one yourself, or have it drafted from a released College Board question and edit before it goes live."
          action={<ButtonLink href="/teacher/assignments/new">New FRQ</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                      <span className="text-xs text-subtle">{a.sectionName}</span>
                    </div>
                    <h2 className="font-medium text-foreground">
                      <a href={`/teacher/assignments/${a.id}`} className="hover:underline">
                        {a.title}
                      </a>
                    </h2>
                    <p className="mt-1 text-sm text-muted">{STATUS_BLURB[a.status]}</p>
                    {a.status !== "draft" ? (
                      <p className="mt-1 text-sm text-subtle">
                        {a.submittedCount} of {a.rosterCount} submitted
                      </p>
                    ) : null}
                  </div>
                  <LifecycleButtons id={a.id} status={a.status} submittedCount={a.submittedCount} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
