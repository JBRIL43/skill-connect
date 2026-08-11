"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { MatchStatus } from "@/lib/data/types";

import {
  runMatchAction,
  setMatchStatusAction,
  type RunMatchState,
  type SetStatusState,
} from "../../actions";

function RunButton({ hasResults }: { hasResults: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? "Scoring candidates…"
        : hasResults
          ? "Re-run matching"
          : "Run matching"}
    </Button>
  );
}

export function RunMatchForm({
  postingId,
  hasResults,
}: {
  postingId: string;
  hasResults: boolean;
}) {
  const [state, formAction] = useActionState<RunMatchState, FormData>(
    runMatchAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="posting_id" value={postingId} />
      <RunButton hasResults={hasResults} />

      {state.error ? (
        <p className="text-sm text-gap-400" role="alert">
          {state.error}
        </p>
      ) : state.considered !== undefined ? (
        <p className="text-[11px] leading-relaxed text-slate-500" role="status">
          {state.considered} opted-in candidate
          {state.considered === 1 ? "" : "s"} considered, {state.matched} cleared
          every threshold.
        </p>
      ) : null}
    </form>
  );
}

const NEXT_LABEL: Record<MatchStatus, string> = {
  suggested: "Shortlist",
  shortlisted: "Mark as hired",
  hired: "Hired",
};

function StatusButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function MatchStatusForm({
  matchId,
  postingId,
  status,
}: {
  matchId: string;
  postingId: string;
  status: MatchStatus;
}) {
  const [state, formAction] = useActionState<SetStatusState, FormData>(
    setMatchStatusAction,
    {},
  );

  if (status === "hired") return null;

  const next: MatchStatus = status === "suggested" ? "shortlisted" : "hired";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="posting_id" value={postingId} />
      <input type="hidden" name="status" value={next} />
      <StatusButton label={NEXT_LABEL[status]} />

      {state.error ? (
        <span className="text-[11px] text-gap-400" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
