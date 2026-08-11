"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { generateHandoverChallengeAction, type HandoverState } from "../../actions";

function BuildButton({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={existing ? "secondary" : "default"} disabled={pending}>
      {pending
        ? "Building the challenge…"
        : existing
          ? "Rebuild from the brief"
          : "Build the handover challenge"}
    </Button>
  );
}

export function HandoverChallengeForm({
  postingId,
  existingNodeId,
}: {
  postingId: string;
  existingNodeId: string | null;
}) {
  const [state, formAction] = useActionState<HandoverState, FormData>(
    generateHandoverChallengeAction,
    {},
  );

  const nodeId = state.nodeId ?? existingNodeId;

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="posting_id" value={postingId} />
        <BuildButton existing={Boolean(existingNodeId)} />

        {state.error ? (
          <p className="text-sm text-gap-400" role="alert">
            {state.error}
          </p>
        ) : state.nodeId ? (
          <p className="text-[11px] leading-relaxed text-slate-500" role="status">
            {state.regenerated ? "Rebuilt" : "Published"} as “{state.title}”. It
            is now in every candidate&apos;s node tree.
          </p>
        ) : null}
      </form>

      {nodeId ? (
        <Link
          href={`/sandbox/${nodeId}`}
          className="inline-block text-sm text-verdant-400 hover:text-verdant-300"
        >
          Preview the challenge candidates will see →
        </Link>
      ) : null}
    </div>
  );
}
