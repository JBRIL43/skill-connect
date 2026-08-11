import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionProfile, homePathForRole } from "@/lib/auth";

const PILLARS = [
  {
    step: "01",
    title: "AI Talent Discovery Coach",
    description:
      "A conversation in Amharic or English that surfaces what you can already do — including the human skills a form never thinks to ask about.",
  },
  {
    step: "02",
    title: "Walk-With-AI Sandbox",
    description:
      "Real Ethiopian business challenges solved alongside an AI assistant, graded against a visible rubric into a score companies can trust.",
  },
  {
    step: "03",
    title: "SME Talent Matcher",
    description:
      "Companies set the bar once as a reusable Role Skill Template, then hear about every candidate who clears it. No reposting, no résumé pile.",
  },
  {
    step: "04",
    title: "Institutional Handover",
    description:
      "When someone resigns, an AI interview turns their day-to-day into a continuity brief and a challenge their replacement is scored against.",
  },
];

const STATS = [
  { value: "82/100", label: "Graded, not self-reported" },
  { value: "2", label: "Languages — Amharic and English" },
  { value: "0", label: "Résumés required" },
];

const SME_HOOKS = [
  {
    icon: "⚡",
    title: "Free AI Readiness Snapshot",
    description:
      "5 questions. Instant report showing which tasks an AI-fluent hire could take off your plate this month — no account needed.",
    href: "/readiness",
    cta: "Get your snapshot →",
  },
  {
    icon: "🔔",
    title: "Role Skill Templates",
    description:
      "Set the bar once. Every candidate who clears your thresholds appears automatically — no re-posting, no inbox pile.",
    href: "/signup",
    cta: "Start hiring →",
  },
  {
    icon: "📋",
    title: "Free Continuity Brief on Resignation",
    description:
      "Someone just quit? Capture their knowledge in a 10-minute AI interview, free. The natural next step is finding their replacement.",
    href: "/signup",
    cta: "Capture knowledge →",
  },
];

const TRUST_POINTS = [
  {
    title: "Scores, not self-reports",
    body: "Every number on a candidate's profile comes from a graded work simulation, not a checkbox they ticked.",
  },
  {
    title: "Opt-in matching",
    body: "A candidate enters the talent pool only when they toggle on discoverability. No passive surveillance.",
  },
  {
    title: "Derived data only",
    body: "Companies see match scores and gap analysis. Raw conversation transcripts and skill matrices stay private to the candidate.",
  },
  {
    title: "Row Level Security",
    body: "Access rules are enforced at the database layer, not just hidden behind the UI — so they hold even if application logic changes.",
  },
];

export default async function Home() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-base font-semibold tracking-tight">
            Skill<span className="text-primary">·</span>Connect{" "}
            <span className="font-normal text-muted-foreground">Ethiopia</span>
          </span>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="hidden sm:inline-flex"
              render={<Link href="/readiness" />}
            >
              Free SME Snapshot
            </Button>
            <Button
              size="sm"
              variant={profile ? "default" : "outline"}
              render={
                <Link
                  href={profile ? homePathForRole(profile.role) : "/login"}
                />
              }
            >
              {profile ? "Dashboard" : "Sign in"}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--accent),transparent_60%)] opacity-70"
          />

          <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <Badge variant="secondary" className="mb-6">
              The human capability acceleration engine for the AI era
            </Badge>

            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Verified ability,{" "}
              <span className="text-primary">not a résumé claim.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              AI will not replace Ethiopian youth. A person working with AI will
              replace a person working alone. Skill-Connect coaches young
              people, grades what they can actually do, and hands Ethiopian SMEs
              talent whose capability has been scored rather than guessed.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-12 px-7 text-base"
                render={<Link href="/signup" />}
              >
                Get started free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base"
                render={<Link href="/readiness" />}
              >
                Free SME snapshot
              </Button>
            </div>

            <dl className="mt-16 grid max-w-2xl gap-8 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            How it works
          </h2>

          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.step}
                className="bg-card p-8 transition-colors hover:bg-accent/40"
              >
                <span className="font-mono text-sm text-primary">
                  {pillar.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SME free hooks ── */}
        <section className="border-y bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              For companies
            </h2>
            <p className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-balance">
              Start free. Pay only when you hire verified talent.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {SME_HOOKS.map((hook) => (
                <div
                  key={hook.title}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-6"
                >
                  <span className="text-2xl" aria-hidden>
                    {hook.icon}
                  </span>
                  <h3 className="font-semibold tracking-tight">{hook.title}</h3>
                  <p className="flex-1 text-sm text-muted-foreground">
                    {hook.description}
                  </p>
                  <Link
                    href={hook.href}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {hook.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust & security ── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Privacy and security
          </h2>
          <p className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-balance">
            The matching mechanism is powerful because it has real boundaries.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_POINTS.map((point) => (
              <div key={point.title} className="space-y-2">
                <h3 className="font-semibold tracking-tight">{point.title}</h3>
                <p className="text-sm text-muted-foreground">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Built for Ethiopia&rsquo;s SMEs and youth — on Telebirr, in Amharic,
              scored not guessed.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Free for job seekers, always. Companies start with a free AI
              Readiness Snapshot before they ever pay for a match.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-12 px-7 text-base"
                render={<Link href="/signup" />}
              >
                Create your account
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base"
                render={<Link href="/readiness" />}
              >
                Free SME snapshot
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>
            Skill-Connect Ethiopia — Cursor AI Hackathon Ethiopia, Addis Ababa.
          </span>
          <div className="flex gap-4">
            <Link href="/readiness" className="hover:text-foreground">
              Free SME Snapshot
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
