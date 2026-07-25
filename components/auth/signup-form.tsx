"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signUpAction, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SelfServeRole = "job_seeker" | "sme";

const ROLE_OPTIONS: { value: SelfServeRole; title: string; blurb: string }[] = [
  {
    value: "job_seeker",
    title: "I'm looking for work",
    blurb: "Get coached, build verified scores",
  },
  {
    value: "sme",
    title: "I'm hiring",
    blurb: "Find capability-verified talent",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignupForm() {
  const [role, setRole] = useState<SelfServeRole>("job_seeker");
  const [state, formAction] = useActionState<AuthState, FormData>(
    signUpAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value={role} />

      <div className="grid gap-2 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            aria-pressed={role === option.value}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              role === option.value
                ? "border-foreground bg-accent"
                : "border-border hover:bg-accent/50",
            )}
          >
            <span className="block text-sm font-medium">{option.title}</span>
            <span className="block text-xs text-muted-foreground">
              {option.blurb}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>

      {role === "sme" ? (
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input id="company_name" name="company_name" required />
          <p className="text-xs text-muted-foreground">
            New companies start unverified and are approved by an admin.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09XX XXX XXX"
        />
        <p className="text-xs text-muted-foreground">
          Saved to your profile. Sign-in is by email — we do not send SMS codes.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {state.notice}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
