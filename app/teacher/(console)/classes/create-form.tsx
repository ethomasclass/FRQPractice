"use client";

import { useActionState } from "react";
import { createSection } from "@/app/actions/teacher";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

export function CreateClassForm() {
  const [state, action, pending] = useActionState(createSection, {} as { error?: string });

  return (
    <Card className="mb-8 p-5">
      <form action={action} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="Class name">
          <Input name="name" placeholder="AP Human Geography — Period 2" required />
        </Field>
        <Field label="Term">
          <Input name="term" placeholder="Fall 2026" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add class"}
        </Button>
      </form>
      {state?.error ? <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div> : null}
    </Card>
  );
}
