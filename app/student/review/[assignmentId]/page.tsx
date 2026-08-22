import { redirect } from "next/navigation";
import { nextReviewId } from "@/app/actions/review";

/** Sends the student straight to their next unfinished review. */
export default async function ReviewEntry({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const id = await nextReviewId(assignmentId);
  redirect(id ? `/student/review/${assignmentId}/${id}` : "/student");
}
