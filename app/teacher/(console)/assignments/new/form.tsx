"use client";

import { useActionState } from "react";
import { createAssignment } from "@/app/actions/teacher";
import { Button, Card, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";

export function NewAssignmentForm({ sections }: { sections: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createAssignment, {} as { error?: string; id?: string });

  // The server action returns the new id rather than redirecting, so the rubric
  // editor is the very next thing the teacher sees.
  if (state?.id && typeof window !== "undefined") {
    window.location.href = `/teacher/assignments/${state.id}`;
  }

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <Field label="Class">
          <Select name="sectionId" required>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title" hint="What students will see in their list.">
          <Input name="title" placeholder="Supranational Organizations and Sovereignty" required />
        </Field>

        <Field label="Scene-setter" hint="The sentence above the parts. Optional.">
          <Textarea
            name="intro"
            rows={3}
            placeholder="The European Union (EU) and Association of Southeast Asian Nations (ASEAN) are supranational organizations composed of independent member states."
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Time limit (minutes)" hint="The real exam allows 25 per question. 0 means untimed.">
            <Input name="timeLimitMinutes" type="number" min={0} max={180} defaultValue={25} />
          </Field>
          <Field label="Reviewers per response" hint="Four gives a majority that can still split.">
            <Input name="reviewsPerResponse" type="number" min={2} max={8} defaultValue={4} />
          </Field>
        </div>

        {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Create and write the rubric"}
        </Button>
      </form>
    </Card>
  );
}
