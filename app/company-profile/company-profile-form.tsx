"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyProfile } from "@/lib/data/types";

import { saveCompanyProfileAction, type CompanyProfileState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

export function CompanyProfileForm({ profile }: { profile: CompanyProfile }) {
  const [state, formAction] = useActionState<CompanyProfileState, FormData>(
    saveCompanyProfileAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="company_name">Company name</Label>
        <Input
          id="company_name"
          name="company_name"
          defaultValue={profile.company_name}
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            name="industry"
            defaultValue={profile.industry ?? ""}
            placeholder="Textiles & fabric wholesale"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Input
            id="size"
            name="size"
            defaultValue={profile.size ?? ""}
            placeholder="12 employees"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="about">Your AI adoption story</Label>
        <Textarea
          id="about"
          name="about"
          rows={6}
          defaultValue={profile.about ?? ""}
          placeholder="What you have already changed, and what you want a new hire to take on."
        />
        <p className="text-xs text-slate-500">
          This is what a candidate reads before applying. Concrete beats
          aspirational.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-gap-400" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.saved ? (
        <p className="text-sm text-verdant-400" role="status">
          Saved. Your public page is updated.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
