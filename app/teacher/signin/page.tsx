import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { TeacherSignInForm } from "./form";

export default async function TeacherSignInPage() {
  const viewer = await getViewer();
  if (viewer?.role === "teacher") redirect("/teacher");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Teacher sign in</h1>
          <p className="mt-2 text-sm text-muted">Use the password from your environment settings.</p>
        </div>

        <TeacherSignInForm />

        <p className="mt-8 text-center text-sm text-subtle">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Back to student sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
