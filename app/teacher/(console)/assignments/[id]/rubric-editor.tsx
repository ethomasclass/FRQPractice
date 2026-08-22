"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskVerb } from "@/lib/db/schema";
import { saveRubric } from "@/app/actions/teacher";
import { VERB_DEMAND } from "@/lib/labels";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { DraftPanel, type DraftedPart } from "./draft-panel";

type Part = {
  label: string;
  taskVerb: TaskVerb;
  promptText: string;
  graderNote: string;
  criteria: { code: string; text: string }[];
};

const VERBS: TaskVerb[] = ["Define", "Identify", "Describe", "Explain", "Compare"];
const LETTERS = "ABCDEFG".split("");

function blankPart(index: number): Part {
  return {
    label: LETTERS[index] ?? `P${index + 1}`,
    taskVerb: "Explain",
    promptText: "",
    graderNote: "",
    criteria: [{ code: `${LETTERS[index] ?? "P"}1`, text: "" }],
  };
}

export function RubricEditor({
  assignmentId,
  locked,
  initialParts,
  exemplars,
  aiReady,
}: {
  assignmentId: string;
  locked: boolean;
  initialParts: Part[];
  exemplars: { id: string; title: string }[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>(
    initialParts.length ? initialParts : Array.from({ length: 7 }, (_, i) => blankPart(i)),
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [drafted, setDrafted] = useState<{ intro: string } | null>(null);

  /**
   * A draft only ever lands in the editor. It is not written anywhere until the
   * teacher reads it and presses Save — a rubric defines "correct" for peer
   * scoring, AI scoring, and calibration at once, so an unreviewed one would
   * quietly corrupt every number downstream.
   */
  function applyDraft(parts: DraftedPart[], intro: string) {
    setParts(parts);
    setDrafted({ intro });
    setSaved(false);
  }

  function patch(i: number, next: Partial<Part>) {
    setParts((prev) => prev.map((p, j) => (i === j ? { ...p, ...next } : p)));
    setSaved(false);
  }

  function patchCriterion(pi: number, ci: number, text: string) {
    setParts((prev) =>
      prev.map((p, j) =>
        j === pi ? { ...p, criteria: p.criteria.map((c, k) => (k === ci ? { ...c, text } : c)) } : p,
      ),
    );
    setSaved(false);
  }

  function addCriterion(pi: number) {
    setParts((prev) =>
      prev.map((p, j) =>
        j === pi ? { ...p, criteria: [...p.criteria, { code: `${p.label}${p.criteria.length + 1}`, text: "" }] } : p,
      ),
    );
  }

  function removeCriterion(pi: number, ci: number) {
    setParts((prev) =>
      prev.map((p, j) =>
        j === pi
          ? {
              ...p,
              // Renumber so codes stay contiguous — reviewers cite these.
              criteria: p.criteria
                .filter((_, k) => k !== ci)
                .map((c, k) => ({ ...c, code: `${p.label}${k + 1}` })),
            }
          : p,
      ),
    );
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await saveRubric(assignmentId, parts);
      setSaved(true);
      router.refresh();
    });
  }

  const totalPoints = parts.length;

  return (
    <section>
      {!locked ? <DraftPanel exemplars={exemplars} aiReady={aiReady} onDraft={applyDraft} /> : null}

      {drafted ? (
        <Card className="mb-4 border-brand-border bg-brand-soft p-4">
          <p className="text-sm font-medium text-foreground">Draft loaded — nothing is saved yet.</p>
          <p className="mt-1 text-sm text-muted">
            Read every acceptable response before you save. On Explain parts especially, check each one actually
            contains the causal link — that is the point students lose most often, and a rubric that is vague here makes
            both your reviewers and the scorer unreliable.
          </p>
          {drafted.intro ? (
            <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-foreground">
              <span className="font-medium">Suggested scene-setter:</span> {drafted.intro}
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rubric</h2>
          <p className="text-sm text-muted">
            One part, one point — {totalPoints} points total. Under each part, list every answer you&apos;d accept.
            Reviewers pick which one a response matched, so these lines are what the whole class is graded against.
          </p>
        </div>
        {locked ? (
          <Badge tone="neutral">Locked — writing has opened</Badge>
        ) : (
          <div className="flex items-center gap-3">
            {saved ? <span className="text-sm text-earned">Saved</span> : null}
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save rubric"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {parts.map((part, i) => (
          <Card key={i} className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-on-brand">
                {part.label}
              </span>
              <Select
                value={part.taskVerb}
                onChange={(e) => patch(i, { taskVerb: e.target.value as TaskVerb })}
                disabled={locked}
                className="w-auto"
              >
                {VERBS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-subtle">1 point</span>
            </div>

            <Textarea
              rows={2}
              value={part.promptText}
              onChange={(e) => patch(i, { promptText: e.target.value })}
              disabled={locked}
              placeholder="Explain how deindustrialization has affected the economy of core countries."
            />
            <p className="mt-1.5 text-xs text-subtle">{VERB_DEMAND[part.taskVerb]}</p>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">
                Accept any one of these
              </p>
              <ul className="space-y-2">
                {part.criteria.map((c, ci) => (
                  <li key={ci} className="flex items-start gap-2">
                    <span className="mt-2.5 w-9 shrink-0 font-mono text-xs font-semibold text-brand">{c.code}</span>
                    <Textarea
                      rows={2}
                      value={c.text}
                      onChange={(e) => patchCriterion(i, ci, e.target.value)}
                      disabled={locked}
                      placeholder="An acceptable response a reader would award the point for."
                    />
                    {!locked && part.criteria.length > 1 ? (
                      <Button variant="ghost" size="sm" onClick={() => removeCriterion(i, ci)} aria-label="Remove">
                        ✕
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!locked ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => addCriterion(i)}>
                  + Add acceptable response
                </Button>
              ) : null}
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle">
                  Note for graders (never shown to the writer)
                </span>
                <Input
                  value={part.graderNote}
                  onChange={(e) => patch(i, { graderNote: e.target.value })}
                  disabled={locked}
                  placeholder="e.g. Do not accept an example without the causal link."
                />
              </label>
            </div>
          </Card>
        ))}
      </div>

      {!locked ? (
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" onClick={() => setParts((p) => [...p, blankPart(p.length)])}>
            + Add part
          </Button>
          {parts.length > 1 ? (
            <Button variant="ghost" onClick={() => setParts((p) => p.slice(0, -1))}>
              Remove last part
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
