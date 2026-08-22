import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer?.role !== "teacher") redirect("/teacher/signin");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/teacher" className="flex items-center gap-2 font-semibold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs text-on-brand">FRQ</span>
              Practice
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/teacher" className="text-muted hover:text-foreground">
                Assignments
              </Link>
              <Link href="/teacher/classes" className="text-muted hover:text-foreground">
                Classes
              </Link>
            </nav>
          </div>
          <form action={signOutAction}>
            <button className="text-sm text-subtle underline underline-offset-4 hover:text-foreground">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
