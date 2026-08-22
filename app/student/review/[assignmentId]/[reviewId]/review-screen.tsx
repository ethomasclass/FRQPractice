"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotEarnedReason } from "@/lib/db/schema";
import { completeReview, loadReview, saveMark } from "@/app/actions/review";
import { NOT_EARNED_REASONS, VERB_DEMAND } from "@/lib/labels";
import { Badge, Button, Card, Select, Textarea } from "@/components/ui";

type Data = Awaited<ReturnType<typeof loadReview>>;

type Draft = {
  earned: boolean | null;
  highlightStart: number | null;
  highlightEnd: number | null;
  highlightText: string;
  criterionCode: string;
  reason: NotEarnedReason | null;
  comment: string;
};

const emptyDraft: Draft = {
  earned: null,
  highlightStart: null,
  highlightEnd: null,
  highlightText: "",
  criterionCode: "",
  reason: null,
  comment: "",
};

/**
 * Character offset of `node`+`offset` within `container`, walking the tree so
 * offsets stay correct after the highlight splits the text into spans.
 */
function offsetWithin(container: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

export function ReviewScreen({ assignmentId, data }: { assignmentId: string; data: Data }) {
  const router = useRouter();
  const responseRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const seed: Record<string, Draft> = {};
    for (const part of data.parts) {
      const existing = data.marks.find((m) => m.partId === part.id);
      seed[part.id] = existing
        ? {
            earned: existing.earned,
            highlightStart: existing.highlightStart,
            highlightEnd: existing.highlightEnd,
            highlightText: existing.highlightText,
            criterionCode: existing.criterionCode,
            reason: existing.reason,
            comment: existing.comment,
          }
        : { ...emptyDraft };
    }
    return seed;
  });

  const part = data.parts[index];
  const draft = drafts[part.id] ?? emptyDraft;
  const isLast = index === data.parts.length - 1;

  function update(patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [part.id]: { ...prev[part.id], ...patch } }));
  }

  function captureSelection() {
    const container = responseRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    const start = offsetWithin(container, range.startContainer, range.startOffset);
    const end = offsetWithin(container, range.endContainer, range.endOffset);
    if (end - start < 2) return; // a stray click-drag isn't evidence

    update({
      highlightStart: Math.min(start, end),
      highlightEnd: Math.max(start, end),
      highlightText: data.responseText.slice(Math.min(start, end), Math.max(start, end)),
    });
    selection.removeAllRanges();
  }

  /** Earned needs evidence and a criterion; not earned needs a named reason. */
  const canAdvance =
    draft.earned === true
      ? draft.highlightStart !== null && draft.criterionCode !== ""
      : draft.earned === false
        ? draft.reason !== null
        : false;

  async function persist() {
    await saveMark({
      reviewId: data.review.id,
      partId: part.id,
      earned: draft.earned === true,
      highlightStart: draft.highlightStart,
      highlightEnd: draft.highlightEnd,
      highlightText: draft.highlightText,
      criterionCode: draft.criterionCode,
      reason: draft.reason,
      comment: draft.comment,
    });
  }

  async function onNext() {
    if (!canAdvance || saving) return;
    setSaving(true);
    try {
      await persist();
      if (!isLast) {
        setIndex((i) => i + 1);
        responseRef.current?.scrollTo({ top: 0 });
      } else {
        await completeReview(data.review.id);
        router.push(`/student/review/${assignmentId}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const segments = useMemo(() => {
    const { highlightStart: s, highlightEnd: e } = draft;
    if (s === null || e === null) return [{ text: data.responseText, marked: false }];
    return [
      { text: data.responseText.slice(0, s), marked: false },
      { text: data.responseText.slice(s, e), marked: true },
      { text: data.responseText.slice(e), marked: false },
    ].filter((seg) => seg.text.length > 0);
  }, [draft, data.responseText]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                Response {data.review.displayIndex} · Anonymous
              </p>
              <h1 className="font-semibold text-foreground">{data.assignment.title}</h1>
            </div>
            <p className="text-sm text-muted">
              Part {index + 1} of {data.parts.length}
            </p>
          </div>

          <div className="mt-3 flex gap-1" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={data.parts.length}>
            {data.parts.map((p, i) => {
              const d = drafts[p.id];
              const done = d?.earned !== null && d?.earned !== undefined;
              return (
                <span
                  key={p.id}
                  title={`Part ${p.label}`}
                  className={`h-1.5 flex-1 rounded-full ${
                    i === index ? "bg-brand" : done ? "bg-brand-border" : "bg-surface-sunken"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-6 py-6 lg:grid-cols-2">
        {/* Left: what the rubric says should get credit. */}
        <section className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-on-brand">
                {part.label}
              </span>
              <Badge tone="accent">{part.taskVerb}</Badge>
            </div>

            <p className="text-base font-medium leading-relaxed text-foreground">{part.promptText}</p>
            <p className="mt-2 text-sm text-muted">{VERB_DEMAND[part.taskVerb]}</p>

            {part.graderNote ? (
              <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-foreground">{part.graderNote}</p>
            ) : null}

            <hr className="my-4 border-border-subtle" />

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">
              Give the point for any one of these
            </p>
            <ul className="space-y-2">
              {part.criteria.map((c) => (
                <li key={c.code} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="shrink-0 font-mono text-xs font-semibold text-brand">{c.code}</span>
                  <span className="text-foreground">{c.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Right: the response, and the judgment. */}
        <section className="flex flex-col gap-4">
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">
              Select the words that earn this point
            </p>
            <div
              ref={responseRef}
              onMouseUp={captureSelection}
              onTouchEnd={captureSelection}
              className="prose-response max-h-[24rem] min-h-[12rem] select-text overflow-y-auto rounded-lg bg-surface-sunken p-4 text-foreground"
            >
              {segments.map((seg, i) =>
                seg.marked ? (
                  <mark key={i} className="rounded bg-highlight-strong px-0.5 text-foreground">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={draft.earned === true ? "earned" : "secondary"}
                className={draft.earned === true ? "ring-2 ring-earned-border" : ""}
                onClick={() => update({ earned: true, reason: null })}
                aria-pressed={draft.earned === true}
              >
                Earned
              </Button>
              <Button
                variant={draft.earned === false ? "missed" : "secondary"}
                className={draft.earned === false ? "ring-2 ring-missed-border" : ""}
                onClick={() => update({ earned: false, criterionCode: "" })}
                aria-pressed={draft.earned === false}
              >
                Not earned
              </Button>
            </div>

            {draft.earned === true ? (
              <div className="mt-4 space-y-3">
                {draft.highlightStart === null ? (
                  <p className="rounded-lg border border-dashed border-brand-border bg-brand-soft px-3 py-2.5 text-sm text-brand">
                    Highlight the words above that earn it. You can&apos;t give the point without pointing at it.
                  </p>
                ) : (
                  <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-muted">
                    <span className="font-medium text-foreground">You picked:</span> &ldquo;
                    {draft.highlightText.length > 140 ? `${draft.highlightText.slice(0, 140)}…` : draft.highlightText}
                    &rdquo;
                  </p>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Which one does it match?</span>
                  <Select value={draft.criterionCode} onChange={(e) => update({ criterionCode: e.target.value })}>
                    <option value="">Choose an acceptable response…</option>
                    {part.criteria.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.text.length > 80 ? `${c.text.slice(0, 80)}…` : c.text}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            ) : draft.earned === false ? (
              <div className="mt-4 space-y-3">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-foreground">What went wrong?</legend>
                  <div className="space-y-1.5">
                    {NOT_EARNED_REASONS.map((r) => (
                      <label
                        key={r.value}
                        className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          draft.reason === r.value
                            ? "border-missed-border bg-missed-soft"
                            : "border-border-subtle hover:bg-surface-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          className="mt-1"
                          checked={draft.reason === r.value}
                          onChange={() => update({ reason: r.value })}
                        />
                        <span>
                          <span className="font-medium text-foreground">{r.label}</span>
                          <span className="block text-xs text-muted">{r.help}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">
                    What would earn it? <span className="font-normal text-subtle">(optional)</span>
                  </span>
                  <Textarea
                    rows={2}
                    value={draft.comment}
                    onChange={(e) => update({ comment: e.target.value })}
                    placeholder="One sentence on what's missing."
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm text-subtle">
                Read the acceptable responses on the left, then decide.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                Back
              </Button>
              <Button onClick={onNext} disabled={!canAdvance || saving}>
                {saving ? "Saving…" : isLast ? "Finish this review" : `Next: part ${data.parts[index + 1]?.label}`}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
