"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExemplar, deleteExemplar } from "@/app/actions/exemplars";
import { Badge, Button, Card, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";

type Row = {
  id: string;
  title: string;
  kind: "frq" | "scoring_guideline" | "chief_reader";
  year: number | null;
  length: number;
  preview: string;
};

const KIND_LABELS: Record<Row["kind"], string> = {
  scoring_guideline: "Scoring guideline",
  frq: "Question",
  chief_reader: "Chief Reader report",
};

export function ExemplarLibrary({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createExemplar, {} as { error?: string });
  const [adding, setAdding] = useState(rows.length === 0);
  const [, startTransition] = useTransition();

  /**
   * Controlled on purpose. React resets an uncontrolled form after a submit,
   * which would throw away a pasted scoring guideline the moment validation
   * rejected anything — and these pastes are tens of thousands of characters.
   */
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Row["kind"]>("scoring_guideline");
  const [year, setYear] = useState("");

  // Clear only once the row is actually stored.
  const savedCount = rows.length;
  const [lastCount, setLastCount] = useState(savedCount);
  if (savedCount !== lastCount) {
    setLastCount(savedCount);
    if (savedCount > lastCount) {
      setTitle("");
      setBody("");
      setYear("");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      {adding ? (
        <Card className="p-5">
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <Field label="Name">
                <Input
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="2025 Set 1 Q1 — Supranational organizations"
                  required
                />
              </Field>
              <Field label="Type">
                <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Row["kind"])}>
                  <option value="scoring_guideline">Scoring guideline</option>
                  <option value="frq">Question</option>
                  <option value="chief_reader">Chief Reader report</option>
                </Select>
              </Field>
              <Field label="Year">
                <Input
                  name="year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2025"
                />
              </Field>
            </div>

            <Field
              label="Pasted text"
              hint={`Select all in the PDF and paste. Formatting doesn't matter.${
                body ? ` ${body.length.toLocaleString()} characters so far.` : ""
              }`}
            >
              <Textarea
                name="body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </Field>

            {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add exemplar"}
              </Button>
              {rows.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}>Add an exemplar</Button>
      )}

      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-foreground">{row.title}</h2>
                    <Badge tone="accent">{KIND_LABELS[row.kind]}</Badge>
                    {row.year ? <span className="text-xs text-subtle">{row.year}</span> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-subtle">{row.preview}…</p>
                  <p className="mt-1 text-xs text-subtle">{row.length.toLocaleString()} characters</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm(`Remove "${row.title}"?`)) return;
                      await deleteExemplar(row.id);
                      router.refresh();
                    })
                  }
                >
                  Remove
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
