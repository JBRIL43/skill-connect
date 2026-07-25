"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { promoteAction, type PromoteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Promoting…" : "Promote this account"}
    </Button>
  );
}

export function PromoteForm() {
  const [state, formAction] = useActionState<PromoteState, FormData>(
    promoteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Invite code</Label>
        <Input id="code" name="code" type="password" required />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
