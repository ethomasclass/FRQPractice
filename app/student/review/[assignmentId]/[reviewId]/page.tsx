import { notFound } from "next/navigation";
import { loadReview } from "@/app/actions/review";
import { ReviewScreen } from "./review-screen";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ assignmentId: string; reviewId: string }>;
}) {
  const { assignmentId, reviewId } = await params;

  let data: Awaited<ReturnType<typeof loadReview>>;
  try {
    data = await loadReview(reviewId);
  } catch {
    notFound();
  }

  return <ReviewScreen assignmentId={assignmentId} data={data} />;
}
