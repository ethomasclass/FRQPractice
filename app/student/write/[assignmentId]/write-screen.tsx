"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, submitResponse } from "@/app/actions/writing";
import { formatClock, wordCount } from "@/lib/time";
import { Badge, Button, Card } from "@/components/ui";

const SAVE_DEBOUNCE_MS = 1200;
/** Re-sync with the server clock periodically; drift and sleeping tabs are real. */
const CLOCK_SYNC_MS = 20_000;

type Props = {
  responseId: string;
  initialText: string;
  initialRemainingMs: number | null;
  assignment: { title: string; intro: string; stimulusText: string; stimulusImageUrl: string; isMakeup: boolean };
  parts: { label: string; promptText: string }[];
};

export function WriteScreen({ responseId, initialText, initialRemainingMs, assignment, parts }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [left, setLeft] = useState(initialRemainingMs);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("saved");
  const [submitting, setSubmitting] = useState(false);

  const textRef = useRef(text);
  textRef.current = text;
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    router.push("/student");
    router.refresh();
  }, [router]);

  const push = useCallback(async () => {
    if (doneRef.current) return;
    setSaveState("saving");
    try {
      const res = await saveDraft(responseId, textRef.current);
      setLeft(res.remainingMs);
      setSaveState("saved");
      if (res.submitted) finish();
    } catch {
      // Keep the text on screen and try again on the next keystroke; a dropped
      // save must never look like lost work.
      setSaveState("idle");
    }
  }, [responseId, finish]);

  // Debounced autosave on every edit.
  useEffect(() => {
    if (text === initialText && saveState === "saved") return;
    setSaveState("idle");
    const t = setTimeout(push, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Periodic reconciliation with the server's clock.
  useEffect(() => {
    if (initialRemainingMs === null) return;
    const t = setInterval(push, CLOCK_SYNC_MS);
    return () => clearInterval(t);
  }, [initialRemainingMs, push]);

  // Local countdown between syncs, purely for display.
  useEffect(() => {
    if (left === null) return;
    const t = setInterval(() => {
      setLeft((prev) => {
        if (prev === null) return prev;
        const next = Math.max(0, prev - 1000);
        if (next === 0) void push();
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [left === null, push]); // eslint-disable-line react-hooks/exhaustive-deps

  // Best-effort flush if they close the tab. The server clock is the real
  // safety net; this just avoids losing the last few seconds of typing.
  useEffect(() => {
    const handler = () => void saveDraft(responseId, textRef.current).catch(() => {});
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [responseId]);

  async function onSubmit() {
    if (!confirm("Submit your response? You can't edit it after this.")) return;
    setSubmitting(true);
    try {
      await submitResponse(responseId, textRef.current);
      finish();
    } finally {
      setSubmitting(false);
    }
  }

  const words = wordCount(text);
  const urgent = left !== null && left <= 5 * 60_000;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-foreground">{assignment.title}</h1>
            <p className="text-xs text-subtle">
              {words} {words === 1 ? "word" : "words"} ·{" "}
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Unsaved changes"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {assignment.isMakeup ? <Badge tone="accent">Makeup</Badge> : null}
            {left !== null ? (
              <span
                className={`rounded-lg px-3 py-1.5 font-mono text-lg tabular-nums ${
                  urgent ? "bg-missed-soft text-missed" : "bg-surface-muted text-foreground"
                }`}
                aria-live="polite"
                aria-label={`Time remaining: ${formatClock(left)}`}
              >
                {formatClock(left)}
              </span>
            ) : null}
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            {assignment.intro ? <p className="mb-4 text-sm leading-relaxed text-foreground">{assignment.intro}</p> : null}

            {assignment.stimulusImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assignment.stimulusImageUrl}
                alt="Stimulus for this question"
                className="mb-4 w-full rounded-lg border border-border-subtle"
              />
            ) : null}
            {assignment.stimulusText ? (
              <pre className="mb-4 overflow-x-auto rounded-lg bg-surface-sunken p-3 text-xs leading-relaxed text-foreground">
                {assignment.stimulusText}
              </pre>
            ) : null}

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand">
              Respond to all {parts.length} parts
            </p>
            <ol className="space-y-3">
              {parts.map((p) => (
                <li key={p.label} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="font-semibold text-brand">{p.label}.</span>
                  <span className="text-foreground">{p.promptText}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>

        <main className="flex flex-col">
          <label htmlFor="response" className="sr-only">
            Your response
          </label>
          <textarea
            id="response"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            spellCheck
            placeholder="Write your response here. Label each part — A, B, C — so your reviewers can find them."
            className="prose-response min-h-[28rem] flex-1 resize-none rounded-xl border border-border-subtle bg-surface p-6 text-foreground placeholder:text-subtle focus:border-brand focus:outline-none"
          />
          <p className="mt-3 text-xs text-subtle">
            Your work saves automatically. If your device dies or you close the tab, everything you have typed is
            already safe and your timer keeps running.
          </p>
        </main>
      </div>
    </div>
  );
}
