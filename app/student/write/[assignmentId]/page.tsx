import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assignments } from "@/lib/db/schema";
import { requireStudent } from "@/lib/auth";
import { openResponse, partsForAssignment } from "@/app/actions/writing";
import { remainingMs } from "@/lib/time";
import { WriteScreen } from "./write-screen";

export default async function WritePage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const { student } = await requireStudent();

  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
  if (!assignment || assignment.sectionId !== student.sectionId) notFound();
  if (assignment.status === "draft") notFound();

  const response = await openResponse(assignmentId);
  if (response.submittedAt) redirect(`/student`);

  const parts = await partsForAssignment(assignmentId);
  const left = remainingMs({ startedAt: response.startedAt, timeLimitMinutes: assignment.timeLimitMinutes });

  return (
    <WriteScreen
      responseId={response.id}
      initialText={response.text}
      initialRemainingMs={left}
      assignment={{
        title: assignment.title,
        intro: assignment.intro,
        stimulusText: assignment.stimulusText,
        stimulusImageUrl: assignment.stimulusImageUrl,
        isMakeup: response.isMakeup,
      }}
      parts={parts.map((p) => ({ label: p.label, promptText: p.promptText }))}
    />
  );
}
