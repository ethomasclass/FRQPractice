import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export default function HowScoringWorks() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <PageHeader
        title="How scoring works"
        actions={
          <Link href="/student" className="text-sm text-subtle underline underline-offset-4 hover:text-foreground">
            Back
          </Link>
        }
      />

      <Card className="space-y-5 p-6 text-sm leading-relaxed text-foreground">
        <p>
          Each part of an FRQ is worth exactly one point, and there is no partial credit — the same way the real exam is
          scored. A part either meets the rubric or it doesn&apos;t.
        </p>

        <div>
          <h2 className="mb-1 font-semibold">Who scores your answer</h2>
          <p className="text-muted">
            Four classmates read it, without knowing whose it is. For each point, the majority decides. When they split
            evenly, an automated scorer settles it. Your teacher can override any point, and their decision is final.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">About the automated scorer</h2>
          <p className="text-muted">
            An AI reads every response against the same rubric your classmates use, and it writes the feedback you get
            at the end from what your reviewers and your teacher pointed at. It is a tool your teacher uses, not the
            final word — if you think a point is wrong, talk to your teacher.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">You are graded on your reviewing too</h2>
          <p className="text-muted">
            When you review a classmate, your scoring is compared against the official score for those same points. That
            agreement is its own grade. It measures whether you can tell what earns a point — which is the whole skill —
            so scoring everyone a 7 out of 7 will not help you.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Anonymity</h2>
          <p className="text-muted">
            You never see whose response you are reading, and your reviewers never see that the response is yours. Your
            teacher can see everything.
          </p>
        </div>
      </Card>
    </main>
  );
}
