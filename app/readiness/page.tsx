import Link from "next/link";

import { ReadinessForm } from "@/app/readiness/_components/readiness-form";
import { AppHeader } from "@/components/app-header";
import { getSessionProfile } from "@/lib/auth";

export const metadata = {
  title: "Free AI Readiness Snapshot — Skill-Connect Ethiopia",
  description:
    "Answer 5 questions about your business and get an instant report showing which tasks an AI-fluent hire could take off your plate this month.",
};

export default async function ReadinessPage() {
  // Works for both signed-in SMEs and anonymous visitors (no auth required —
  // this is the free hook from Section 5 that gets SMEs into the funnel).
  const profile = await getSessionProfile();
  const isSme = profile?.role === "sme";

  return (
    <div className="min-h-svh bg-muted/30">
      {profile ? (
        <AppHeader profile={profile} />
      ) : (
        <header className="border-b bg-background">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
            <Link href="/" className="font-semibold tracking-tight">
              Skill-Connect{" "}
              <span className="text-muted-foreground">Ethiopia</span>
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 space-y-2">
          {!profile ? (
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to home
            </Link>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            Free AI Readiness Snapshot
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Two minutes to see which tasks an AI-fluent hire could take off your
            plate — and where your business stands on the AI readiness curve.
            Free, no account needed.
          </p>
        </div>

        <ReadinessForm isSme={isSme} />
      </main>
    </div>
  );
}
