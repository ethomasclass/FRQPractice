import { notFound } from "next/navigation";
import Link from "next/link";
import { rosterForJoinCode } from "@/app/actions/auth";
import { NamePicker } from "./name-picker";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await rosterForJoinCode(code);
  if (!data) notFound();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{data.section.term || "Class"}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{data.section.name}</h1>
          <p className="mt-2 text-sm text-muted">Find your name to sign in.</p>
        </div>

        <NamePicker joinCode={data.section.joinCode} roster={data.roster.map((s) => ({ id: s.id, name: s.name }))} />

        <p className="mt-8 text-center text-sm text-subtle">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Wrong class?
          </Link>
        </p>
      </div>
    </main>
  );
}
