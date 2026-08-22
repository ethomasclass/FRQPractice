import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sections, students } from "@/lib/db/schema";
import { requireTeacher } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { RosterEditor } from "./roster-editor";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacher();
  const { id } = await params;

  const section = await db.query.sections.findFirst({ where: eq(sections.id, id) });
  if (!section) notFound();

  const roster = (await db.query.students.findMany({ where: eq(students.sectionId, id) })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <PageHeader
        eyebrow={section.term || "Class"}
        title={section.name}
        description="Students sign in by typing the class code and picking their name. Nothing to reset, nothing to approve."
      />

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-subtle">Class code</p>
          <p className="font-mono text-3xl tracking-[0.2em] text-brand">{section.joinCode}</p>
        </div>
        <p className="max-w-xs text-sm text-muted">
          Students go to the site, type this, and find their name on the roster below.
        </p>
      </Card>

      <RosterEditor sectionId={section.id} roster={roster.map((s) => ({ id: s.id, name: s.name, email: s.email }))} />
    </main>
  );
}
