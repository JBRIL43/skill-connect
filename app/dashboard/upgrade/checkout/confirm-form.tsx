"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPaymentAction, type UpgradeState } from "../actions";

function PayButton({ amount }: { amount: number }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="w-full bg-[#00A651] text-white hover:bg-[#00A651]/90"
    >
      {pending ? "Confirming…" : `Pay ${amount.toLocaleString()} ETB`}
    </Button>
  );
}

export function ConfirmForm({
  externalRef,
  amount,
  defaultPhone,
}: {
  externalRef: string;
  amount: number;
  defaultPhone?: string;
}) {
  const [state, formAction] = useActionState<UpgradeState, FormData>(
    confirmPaymentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="ref" value={externalRef} />

      <div className="space-y-2">
        <Label htmlFor="phone">telebirr number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09XX XXX XXX"
          defaultValue={defaultPhone ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          placeholder="••••••"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Nothing is sent anywhere and no PIN is stored. Type whatever you like.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2 pt-2">
        <PayButton amount={amount} />
        <Button
          variant="ghost"
          className="w-full"
          render={<Link href="/dashboard/upgrade" />}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
