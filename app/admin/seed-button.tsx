"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { seedDemoDataAction, type SeedState } from "./actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Loading personas…" : "Seed demo data"}
    </Button>
  );
}

export function SeedButton() {
  const [state, formAction] = useActionState<SeedState, FormData>(
    seedDemoDataAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton />
      {state.message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
