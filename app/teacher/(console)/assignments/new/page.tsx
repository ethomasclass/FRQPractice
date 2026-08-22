import { redirect } from "next/navigation";
import { listSections } from "@/app/actions/teacher";
import { PageHeader } from "@/components/ui";
import { NewAssignmentForm } from "./form";

export default async function NewAssignmentPage() {
  const sections = await listSections();
  if (sections.length === 0) redirect("/teacher/classes");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeader
        title="New FRQ"
        description="Set it up here, write the rubric next. Nothing is visible to students until you open writing."
      />
      <NewAssignmentForm sections={sections.map((s) => ({ id: s.id, name: s.name }))} />
    </main>
  );
}
