"use client";

import { useActionState } from "react";
import { lookupSectionAction } from "./actions/auth";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

export function JoinForm() {
  const [state, action, pending] = useActionState(lookupSectionAction, {} as { error?: string });

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <Field label="Class code" hint="Your teacher will put this on the board.">
          <Input
            name="joinCode"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. K4TR9M"
            className="text-center font-mono text-lg tracking-[0.25em] uppercase"
            maxLength={12}
          />
        </Field>

        {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
    </Card>
  );
}
