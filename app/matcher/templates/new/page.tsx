import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { requireCurrentProfile } from "@/lib/current-profile";

import { TemplateBuilderForm } from "./template-builder-form";

export default async function NewTemplatePage() {
  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <Link
            href="/matcher"
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to matching
          </Link>

          <div className="space-y-2">
            <span className="label-caps">Role Skill Template</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Set the bar once
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              You are defining ability, not credentials. Every threshold below is
              checked against scores candidates earned in graded work
              simulations, so nobody appears in your results on the strength of a
              CV.
            </p>
          </div>
        </div>

        <TemplateBuilderForm />
      </main>
    </div>
  );
}
