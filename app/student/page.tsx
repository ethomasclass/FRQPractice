import { getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentHome() {
  const viewer = await getViewer();
  if (viewer?.role !== "student") redirect("/");
  return <main className="p-8">Signed in as {viewer.student.name}</main>;
}
