import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { JoinForm } from "./join-form";

export default async function HomePage() {
  const viewer = await getViewer();
  if (viewer?.role === "teacher") redirect("/teacher");
  if (viewer?.role === "student") redirect("/student");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-on-brand">
            FRQ
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">FRQ Practice</h1>
          <p className="mt-2 text-sm text-muted">AP Human Geography free-response practice and peer review.</p>
        </div>

        <JoinForm />

        <p className="mt-8 text-center text-sm text-subtle">
          <Link href="/teacher/signin" className="underline underline-offset-4 hover:text-foreground">
            Teacher sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
