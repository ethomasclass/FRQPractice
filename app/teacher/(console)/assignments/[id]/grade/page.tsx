import { notFound } from "next/navigation";

/**
 * Scoring and feedback run one response per request from this page. Each takes
 * 15-25 seconds, so the default 10-second budget is not enough — 60 is the
 * ceiling on Vercel's Hobby plan and comfortably more than one response needs.
 */
export const maxDuration = 60;
import { gradeView } from "@/app/actions/gradebook";
import { aiConfigured } from "@/lib/ai/client";
import { PageHeader } from "@/components/ui";
import { GradeBoard } from "./grade-board";

export default async function GradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await gradeView(id);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Grading"
        title={view.assignment.title}
        description="Sorted with the contested points first — where reviewers split, where they disagreed with the independent read, or where the scorer itself was unsure. Everything you don't touch releases as it stands."
      />
      <GradeBoard
        assignmentId={id}
        rows={view.rows}
        calibration={view.calibration}
        outOf={view.parts.length}
        aiReady={aiConfigured()}
        status={view.assignment.status}
      />
    </main>
  );
}
