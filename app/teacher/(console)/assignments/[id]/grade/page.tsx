import { notFound } from "next/navigation";
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
        description="Sorted with the contested points first — where reviewers split, or where they disagreed with the independent read. Everything you don't touch releases as it stands."
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
