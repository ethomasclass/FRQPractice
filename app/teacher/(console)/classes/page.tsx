import { listSections } from "@/app/actions/teacher";
import { CreateClassForm } from "./create-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import Link from "next/link";

export default async function ClassesPage() {
  const sections = await listSections();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <PageHeader
        title="Classes"
        description="Each class gets a code students type once. Put it on the board on writing day."
      />

      <CreateClassForm />

      {sections.length === 0 ? (
        <EmptyState title="No classes yet" description="Add one above, then paste your roster in." />
      ) : (
        <ul className="space-y-3">
          {sections.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="font-medium text-foreground">
                    <Link href={`/teacher/classes/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">
                    {s.term ? `${s.term} · ` : ""}
                    {s.studentCount} {s.studentCount === 1 ? "student" : "students"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-subtle">Class code</p>
                  <p className="font-mono text-2xl tracking-[0.2em] text-brand">{s.joinCode}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
