"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentStatus } from "@/lib/db/schema";
import { assignPeerReviews, setAssignmentStatus } from "@/app/actions/teacher";
import { Button, ButtonLink } from "@/components/ui";

export function LifecycleButtons({
  id,
  status,
  submittedCount,
}: {
  id: string;
  status: AssignmentStatus;
  submittedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function move(next: AssignmentStatus) {
    startTransition(async () => {
      await setAssignmentStatus(id, next);
      router.refresh();
    });
  }

  function handOutReviews() {
    startTransition(async () => {
      const res = await assignPeerReviews(id);
      if ("error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={`/teacher/assignments/${id}`} variant="secondary" size="sm">
          Open
        </ButtonLink>

        {status === "draft" ? (
          <Button size="sm" onClick={() => move("writing")} disabled={pending}>
            Open writing
          </Button>
        ) : null}

        {status === "writing" ? (
          <Button size="sm" onClick={handOutReviews} disabled={pending || submittedCount < 2}>
            {pending ? "Assigning…" : "Close writing & assign reviews"}
          </Button>
        ) : null}

        {status === "reviewing" ? (
          <Button size="sm" onClick={() => move("adjudicating")} disabled={pending}>
            Close reviews
          </Button>
        ) : null}

        {status === "adjudicating" ? (
          <ButtonLink href={`/teacher/assignments/${id}/grade`} size="sm">
            Grade contested points
          </ButtonLink>
        ) : null}
      </div>
      {error ? <p className="text-xs text-missed">{error}</p> : null}
      {status === "writing" && submittedCount < 2 ? (
        <p className="text-xs text-subtle">Need 2 submissions to assign reviews.</p>
      ) : null}
    </div>
  );
}
