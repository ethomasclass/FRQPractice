"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importRoster, removeStudent } from "@/app/actions/teacher";
import { Button, Card, Textarea } from "@/components/ui";

export function RosterEditor({
  sectionId,
  roster,
}: {
  sectionId: string;
  roster: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function paste() {
    startTransition(async () => {
      const res = await importRoster(sectionId, raw);
      setNote(
        res.total === 0
          ? "Nothing to import."
          : `Added ${res.added}${res.updated ? `, updated ${res.updated}` : ""} of ${res.total} lines.`,
      );
      setRaw("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-1 font-medium text-foreground">Paste your roster</h2>
        <p className="mb-3 text-sm text-muted">
          One student per line — <code className="text-xs">Name</code> or <code className="text-xs">Name, email</code>.
          Re-pasting the same roster is safe: existing students are matched by name, so nobody is duplicated and no
          submitted work is orphaned.
        </p>
        <Textarea
          rows={6}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"Amara Okafor, aokafor@school.edu\nBen Whitfield, bwhitfield@school.edu"}
          className="font-mono text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={paste} disabled={pending || !raw.trim()}>
            {pending ? "Importing…" : "Import"}
          </Button>
          {note ? <p className="text-sm text-muted">{note}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="border-b border-border-subtle px-5 py-3">
          <h2 className="font-medium text-foreground">
            Roster <span className="text-subtle">({roster.length})</span>
          </h2>
        </div>
        {roster.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-subtle">No students yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  {s.email ? <p className="truncate text-xs text-subtle">{s.email}</p> : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm(`Remove ${s.name}? Their submitted work goes too.`)) return;
                      await removeStudent(s.id);
                      router.refresh();
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
