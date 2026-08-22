"use client";

import { useActionState, useMemo, useState } from "react";
import { studentSignInAction } from "@/app/actions/auth";
import { Button, Card, ErrorNote, Input } from "@/components/ui";

export function NamePicker({ joinCode, roster }: { joinCode: string; roster: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(studentSignInAction, {} as { error?: string });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");

  // A period of 30 is a lot to scroll on a phone; typing three letters beats scrolling.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, roster]);

  return (
    <Card className="overflow-hidden">
      <form action={action}>
        <input type="hidden" name="joinCode" value={joinCode} />
        <input type="hidden" name="studentId" value={selected} />

        <div className="border-b border-border-subtle p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing your name…"
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              No match. Ask your teacher to add you to the roster.
            </p>
          ) : (
            <ul>
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.id)}
                    aria-pressed={selected === s.id}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                      selected === s.id
                        ? "bg-brand-soft font-medium text-brand"
                        : "text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-border-subtle p-4">
          {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          <Button type="submit" size="lg" className="w-full" disabled={!selected || pending}>
            {pending ? "Signing in…" : "That's me"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
