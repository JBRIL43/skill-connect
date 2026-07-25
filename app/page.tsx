import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile, homePathForRole } from "@/lib/auth";

const PILLARS = [
  {
    title: "AI Talent Discovery Coach",
    description:
      "A conversation in Amharic or English that surfaces what you can already do, including the human skills a form never asks about.",
  },
  {
    title: "Walk-With-AI Sandbox",
    description:
      "Real Ethiopian business challenges solved alongside an AI assistant, graded against a visible rubric into a score companies can trust.",
  },
  {
    title: "SME Talent Matcher",
    description:
      "Companies set the bar once as a reusable Role Skill Template, then hear about every candidate who clears it.",
  },
  {
    title: "Institutional Handover",
    description:
      "When someone resigns, an AI interview turns their day-to-day into a continuity brief and a challenge their replacement is scored against.",
  },
];

export default async function Home() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="font-semibold tracking-tight">
            Skill-Connect{" "}
            <span className="text-muted-foreground">Ethiopia</span>
          </span>
          <Button
            size="sm"
            variant={profile ? "default" : "ghost"}
            render={
              <Link href={profile ? homePathForRole(profile.role) : "/login"} />
            }
          >
            {profile ? "Go to dashboard" : "Sign in"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 sm:py-28">
          <p className="text-sm font-medium text-muted-foreground">
            The human capability acceleration engine for the AI era
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Verified ability, not a resume claim.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            AI will not replace Ethiopian youth. A person working with AI will
            replace a person working alone. Skill-Connect coaches young people,
            grades what they can actually do, and hands Ethiopian SMEs talent
            whose capability has been scored rather than guessed.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/signup" />}>
              Get started free
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/readiness" />}
            >
              Free AI Readiness Snapshot
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <CardTitle className="text-base">{pillar.title}</CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
