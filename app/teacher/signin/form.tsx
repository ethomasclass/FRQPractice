"use client";

import { useActionState } from "react";
import { teacherSignInAction } from "@/app/actions/auth";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

export function TeacherSignInForm() {
  const [state, action, pending] = useActionState(teacherSignInAction, {} as { error?: string });

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <Field label="Password">
          <Input name="password" type="password" autoFocus autoComplete="current-password" />
        </Field>
        {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
