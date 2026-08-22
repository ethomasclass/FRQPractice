"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GradeRow } from "@/app/actions/gradebook";
import { overrideMark, releaseAssignment, scoreAssignment, settleAssignment } from "@/app/actions/grading";
import { REASON_LABELS } from "@/lib/labels";
import { Badge, Button, Card } from "@/components/ui";

type Calibration = {
  studentId: string;
  name: string;
  pointsAgreed: number;
  pointsJudged: number;
  reviewsAssigned: number;
  reviewsCompleted: number;
  accuracy: number | null;
};

export function GradeBoard({
  assignmentId,
  rows,
  calibration,
  outOf,
  aiReady,
  status,
}: {
  assignmentId: string;
  rows: GradeRow[];
  calibration: Calibration[];
  outOf: number;
  aiReady: boolean;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(rows[0]?.responseId ?? null);
  const [note, setNote] = useState("");

  const totalContested = rows.reduce((sum, r) => sum + r.contestedCount, 0);
  const scoredCount = rows.filter((r) => r.points.some((p) => p.ai)).length;

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Responses</p>
            <p className="mt-1 text-lg font-medium text-foreground">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Independently scored</p>
            <p className="mt-1 text-lg font-medium text-foreground">
              {scoredCount} of {rows.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-subtle">Contested points</p>
            <p className={`mt-1 text-lg font-medium ${totalContested ? "text-contested" : "text-foreground"}`}>
              {totalContested}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => run(() => scoreAssignment(assignmentId))}
            disabled={pending || !aiReady}
            title={aiReady ? undefined : "Set ANTHROPIC_API_KEY to enable scoring"}
          >
            {pending ? "Working…" : "Score responses"}
          </Button>
          <Button variant="secondary" onClick={() => run(() => settleAssignment(assignmentId))} disabled={pending}>
            Recalculate
          </Button>
          <Button
            onClick={() => {
              if (!confirm("Release scores and feedback to students? This writes feedback for everyone.")) return;
              run(() => releaseAssignment(assignmentId));
            }}
            disabled={pending || status === "released"}
          >
            {status === "released" ? "Released" : "Release to students"}
          </Button>
          <a
            href={`/api/assignments/${assignmentId}/gradebook.csv`}
            className="inline-flex items-center rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Export CSV
          </a>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Responses</h2>
        <div className="space-y-3">
          {rows.map((row) => {
            const isOpen = open === row.responseId;
            return (
              <Card key={row.responseId} className="overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : row.responseId)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-muted"
                  aria-expanded={isOpen}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-medium text-foreground">{row.studentName}</span>
                    {row.isMakeup ? <Badge tone="accent">Makeup</Badge> : null}
                    {row.contestedCount > 0 ? (
                      <Badge tone="contested">
                        {row.contestedCount} contested
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex gap-1">
                      {row.points.map((p) => (
                        <span
                          key={p.partId}
                          title={`${p.label}: ${p.earned ? "earned" : "not earned"}${p.contested ? " (contested)" : ""}`}
                          className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold ${
                            p.contested
                              ? "bg-contested-soft text-contested"
                              : p.earned
                                ? "bg-earned-soft text-earned"
                                : "bg-surface-sunken text-subtle"
                          }`}
                        >
                          {p.label}
                        </span>
                      ))}
                    </span>
                    <span className="w-14 text-right font-mono text-sm text-foreground">
                      {row.score}/{outOf}
                    </span>
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t border-border-subtle bg-surface-muted px-5 py-4">
                    <details className="mb-4">
                      <summary className="cursor-pointer text-sm font-medium text-brand">Read the response</summary>
                      <div className="prose-response mt-3 rounded-lg bg-surface p-4 text-sm">{row.responseText}</div>
                    </details>

                    <ul className="space-y-3">
                      {row.points.map((p) => (
                        <li key={p.partId}>
                          <div
                            className={`rounded-lg border p-4 ${
                              p.contested ? "border-contested bg-contested-soft" : "border-border-subtle bg-surface"
                            }`}
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded bg-brand text-xs font-semibold text-on-brand">
                                {p.label}
                              </span>
                              <span className="text-sm text-muted">{p.promptText}</span>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                              <Badge tone={p.earned ? "earned" : "missed"}>
                                {p.earned ? "Point earned" : "No point"}
                              </Badge>
                              <span className="text-subtle">
                                Peers: {p.peerEarnedCount}/{p.peerTotalCount} gave it
                              </span>
                              {p.ai ? (
                                <span className="text-subtle">
                                  · Independent read: {p.ai.earned ? "earned" : "not earned"}
                                  {p.ai.criterionCode ? ` (${p.ai.criterionCode})` : ""}
                                  {p.ai.confidence < 0.7 ? " · low confidence" : ""}
                                </span>
                              ) : (
                                <span className="text-subtle">· not scored yet</span>
                              )}
                              {p.teacher ? <Badge tone="brand">You decided this</Badge> : null}
                            </div>

                            {p.ai?.justification ? (
                              <p className="mb-2 text-sm text-foreground">{p.ai.justification}</p>
                            ) : null}
                            {p.ai?.quote ? (
                              <p className="mb-2 text-sm text-muted">
                                Cited: <mark className="rounded bg-highlight px-1">{p.ai.quote}</mark>
                              </p>
                            ) : null}

                            {p.peers.length > 0 ? (
                              <details className="mb-2">
                                <summary className="cursor-pointer text-xs text-brand">
                                  What the {p.peers.length} reviewers said
                                </summary>
                                <ul className="mt-2 space-y-1.5 text-xs text-muted">
                                  {p.peers.map((peer, i) => (
                                    <li key={i}>
                                      {peer.earned ? "✓" : "✗"}{" "}
                                      {peer.earned
                                        ? `${peer.criterionCode || "matched"} — "${peer.highlightText.slice(0, 120)}"`
                                        : `${peer.reason ? REASON_LABELS[peer.reason] : "no reason"}${peer.comment ? ` — ${peer.comment}` : ""}`}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant={p.earned ? "earned" : "secondary"}
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    overrideMark({
                                      assignmentId,
                                      responseId: row.responseId,
                                      partId: p.partId,
                                      earned: true,
                                      note,
                                    }),
                                  )
                                }
                              >
                                Give the point
                              </Button>
                              <Button
                                size="sm"
                                variant={!p.earned ? "missed" : "secondary"}
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    overrideMark({
                                      assignmentId,
                                      responseId: row.responseId,
                                      partId: p.partId,
                                      earned: false,
                                      note,
                                    }),
                                  )
                                }
                              >
                                Withhold it
                              </Button>
                              <input
                                placeholder="Optional note — goes into their feedback in your voice"
                                onChange={(e) => setNote(e.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-foreground placeholder:text-subtle focus:border-brand focus:outline-none"
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-foreground">Reviewer calibration</h2>
        <p className="mb-3 text-sm text-muted">
          How often each reviewer agreed with the independent read — or with your ruling, wherever you made one. This is
          the reviewing grade, and it is measured against an independent read rather than the class majority so that
          guessing what everyone else said is not a winning strategy.
        </p>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-5 py-2.5 font-medium">Student</th>
                <th className="px-5 py-2.5 font-medium">Reviews done</th>
                <th className="px-5 py-2.5 font-medium">Points judged</th>
                <th className="px-5 py-2.5 font-medium">Agreed</th>
                <th className="px-5 py-2.5 font-medium">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {calibration.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-subtle">
                    Nothing yet — hand out reviews first.
                  </td>
                </tr>
              ) : (
                calibration.map((c) => (
                  <tr key={c.studentId}>
                    <td className="px-5 py-2.5 text-foreground">{c.name}</td>
                    <td className="px-5 py-2.5 text-muted">
                      {c.reviewsCompleted} of {c.reviewsAssigned}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{c.pointsJudged}</td>
                    <td className="px-5 py-2.5 text-muted">{c.pointsAgreed}</td>
                    <td className="px-5 py-2.5">
                      {c.accuracy == null ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <span
                          className={
                            c.accuracy >= 0.85 ? "text-earned" : c.accuracy >= 0.7 ? "text-foreground" : "text-missed"
                          }
                        >
                          {Math.round(c.accuracy * 100)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
