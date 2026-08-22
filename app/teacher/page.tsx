import { getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TeacherHome() {
  const viewer = await getViewer();
  if (viewer?.role !== "teacher") redirect("/teacher/signin");
  return <main className="p-8">Teacher console</main>;
}
