"use client";

import { useState } from "react";
import type { TaskVerb } from "@/lib/db/schema";
import { draftRubricAction } from "@/app/actions/draft";
import { Button, Card, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";

export type DraftedPart = {
  label: string;
  taskVerb: TaskVerb;
  promptText: string;
  graderNote: string;
  criteria: { code: string; text: string }[];
};

export function DraftPanel({
  exemplars,
  aiReady,
  onDraft,
}: {
  exemplars: { id: string; title: string }[];
  aiReady: boolean;
  onDraft: (parts: DraftedPart[], intro: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [partCount, setPartCount] = useState(7);
  const [notes, setNotes] = useState("");
  const [chosen, setChosen] = useState<string[]>(exemplars.slice(0, 2).map((e) => e.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const result = await draftRubricAction({ topic, partCount, notes, exemplarIds: chosen });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDraft(
        result.draft.parts.map((p) => ({
          label: p.label,
          taskVerb: p.taskVerb as TaskVerb,
          promptText: p.promptText,
          graderNote: "",
          criteria: p.criteria,
        })),
        result.draft.intro,
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="font-medium text-foreground">Draft this with AI</h3>
          <p className="mt-1 text-sm text-muted">
            Give it a topic and it writes the parts and acceptable responses in the style of your exemplars. It loads
            into the editor below for you to fix — nothing is saved until you press Save.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={!aiReady}
          title={aiReady ? undefined : "Set ANTHROPIC_API_KEY to enable drafting"}
        >
          Draft with AI
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-4 p-5">
      <h3 className="mb-4 font-medium text-foreground">Draft a question and rubric</h3>

      <div className="space-y-4">
        <Field label="What should it be about?" hint="A topic, a unit, or the exact question you have in mind.">
          <Textarea
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Agricultural hearths and the diffusion of the Second Agricultural Revolution"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many parts?" hint="Seven matches the real exam.">
            <Input
              type="number"
              min={2}
              max={10}
              value={partCount}
              onChange={(e) => setPartCount(Number(e.target.value))}
            />
          </Field>
          <Field label="Anything else?" hint="Optional.">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keep part G hard — my students need the stretch."
            />
          </Field>
        </div>

        {exemplars.length > 0 ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Match the style of</legend>
            <p className="mb-2 text-xs text-subtle">Two or three is plenty. More does not make it better.</p>
            <div className="space-y-1.5">
              {exemplars.map((e) => (
                <label
                  key={e.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                    chosen.includes(e.id) ? "border-brand-border bg-brand-soft" : "border-border-subtle"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(e.id)}
                    onChange={() =>
                      setChosen((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                    }
                  />
                  <span className="text-foreground">{e.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-lg border border-accent-border bg-accent-soft px-3 py-2.5 text-sm text-foreground">
            No exemplars saved yet. It will still write something usable, but adding two released scoring guidelines
            under <span className="font-medium">Exemplars</span> makes a real difference to how the acceptable
            responses read.
          </p>
        )}

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-3">
          <Button onClick={generate} disabled={busy || !topic.trim()}>
            {busy ? "Writing… (this takes a moment)" : "Draft it"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
