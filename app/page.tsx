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
  { value: "2", label: "Languages, Amharic and English" },
  { value: "0", label: "Résumés required" },
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
          <Button
            size="lg"
            className="h-10 px-5"
            variant={profile ? "default" : "outline"}
            render={
              <Link href={profile ? homePathForRole(profile.role) : "/login"} />
            }
          >
            {profile ? "Go to dashboard" : "Sign in"}
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          {/* Soft radial wash so the hero does not read as a blank document. */}
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
                render={<Link href="/login" />}
              >
                I already have an account
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

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
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
                <p className="mt-2 text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Built for Ethiopia&rsquo;s SMEs and youth — scored, not guessed.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Free for job seekers, always. Companies start with a free AI
              Readiness Snapshot before they ever pay for a match.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 px-7 text-base"
              render={<Link href="/signup" />}
            >
              Create your account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          Skill-Connect Ethiopia — Cursor AI Hackathon Ethiopia, Addis Ababa.
        </div>
      </footer>
    </div>
  );
}
