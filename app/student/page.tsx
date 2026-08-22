import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { studentDashboard } from "@/app/actions/student";
import { signOutAction } from "@/app/actions/auth";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function StudentHome() {
  const viewer = await getViewer();
  if (viewer?.role !== "student") redirect("/");

  const { student, section, tasks } = await studentDashboard();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={section.name}
        title={`Hi, ${student.name.split(" ")[0]}`}
        description="Everything waiting on you is here."
        actions={
          <form action={signOutAction}>
            <button className="text-sm text-subtle underline underline-offset-4 hover:text-foreground">Sign out</button>
          </form>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState title="Nothing to do right now" description="When your teacher opens an FRQ, it will show up here." />
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={`${task.kind}-${task.assignmentId}`}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-foreground">{task.title}</h2>
                    {task.kind === "write" && task.isMakeup ? <Badge tone="accent">Makeup</Badge> : null}
                    {task.kind === "review" && task.done === task.total ? <Badge tone="earned">Done</Badge> : null}
                  </div>
                  <p className="text-sm text-muted">
                    {task.kind === "write"
                      ? task.timeLimitMinutes > 0
                        ? `${task.timeLimitMinutes} minutes once you start.`
                        : "No time limit."
                      : task.kind === "review"
                        ? `${task.done} of ${task.total} reviews finished.`
                        : task.kind === "waiting"
                          ? task.detail
                          : "Your score and feedback are ready."}
                  </p>
                </div>

                {task.kind === "write" ? (
                  <ButtonLink href={`/student/write/${task.assignmentId}`}>Start writing</ButtonLink>
                ) : task.kind === "review" ? (
                  <ButtonLink
                    href={`/student/review/${task.assignmentId}`}
                    variant={task.done === task.total ? "secondary" : "primary"}
                  >
                    {task.done === task.total ? "Review again" : task.done > 0 ? "Keep reviewing" : "Start reviewing"}
                  </ButtonLink>
                ) : task.kind === "result" ? (
                  <ButtonLink href={`/student/results/${task.assignmentId}`} variant="secondary">
                    See results
                  </ButtonLink>
                ) : (
                  <span className="text-sm text-subtle">Submitted</span>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-center text-xs text-subtle">
        Responses you review are anonymous, and yours is anonymous to your reviewers.{" "}
        <Link href="/student/how-scoring-works" className="underline underline-offset-4 hover:text-foreground">
          How scoring works
        </Link>
      </p>
    </main>
  );
}
