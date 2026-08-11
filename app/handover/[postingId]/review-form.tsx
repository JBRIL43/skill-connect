"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import {
  approveBriefAction,
  reopenBriefAction,
  type ReviewState,
} from "../actions";

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Approving…" : "Approve and share this"}
    </Button>
  );
}

function ReopenButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Reopening…" : "Edit this again"}
    </Button>
  );
}

/**
 * The redaction gate. The employee reads the draft, cuts anything they are not
 * willing to share, and approves. Nothing reaches the employer's screen or a
 * candidate's challenge until this button is pressed, which is what makes the
 * service-role read in the challenge generator defensible.
 */
export function ReviewForm({
  postingId,
  draft,
}: {
  postingId: string;
  draft: string;
}) {
  const [state, formAction] = useActionState<ReviewState, FormData>(
    approveBriefAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="posting_id" value={postingId} />

      <div className="space-y-2">
        <label htmlFor="generated_brief" className="label-caps block">
          The brief, as your employer will read it
        </label>
        <textarea
          id="generated_brief"
          name="generated_brief"
          className="field min-h-56 w-full resize-y text-sm leading-relaxed"
          defaultValue={draft}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Edit anything you would not want shared — customer names especially.
          What you leave here is exactly what gets used.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-gap-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <ApproveButton />
    </form>
  );
}

export function ReopenForm({ postingId }: { postingId: string }) {
  const [state, formAction] = useActionState<ReviewState, FormData>(
    reopenBriefAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="posting_id" value={postingId} />
      <ReopenButton />
      {state.error ? (
        <p className="text-sm text-gap-400" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
