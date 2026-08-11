"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { startUpgradeAction, type UpgradeState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Opening checkout…" : label}
    </Button>
  );
}

export function UpgradeButton({ label }: { label: string }) {
  const [state, formAction] = useActionState<UpgradeState, FormData>(
    startUpgradeAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton label={label} />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
