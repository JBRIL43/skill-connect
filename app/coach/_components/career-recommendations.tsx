"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkillMatrixOutput } from "@/lib/ai/schemas";

type ChallengeLink = {
  node_id: string;
  title: string;
  title_am: string;
  sector: string;
  href: string;
};

type RecommendationCard = {
  path_name: string;
  reason: string;
  challenges: ChallengeLink[];
};

export function CareerRecommendations({
  matrix,
}: {
  matrix: SkillMatrixOutput;
}) {
  const [items, setItems] = useState<RecommendationCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/ai/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skills_json: matrix }),
        });
        const payload = (await response.json().catch(() => null)) as {
          recommendations?: RecommendationCard[];
          error?: string;
        } | null;

        if (!response.ok || !payload?.recommendations) {
          throw new Error(payload?.error ?? "Could not load recommendations");
        }

        if (!cancelled) {
          setItems(payload.recommendations);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load recommendations",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [matrix]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Next Sandbox paths</CardTitle>
          <Badge variant="outline">2–3 real challenges</Badge>
        </div>
        <CardDescription>
          AI-resilient next steps linked only to Dev 3&apos;s published Sandbox
          node IDs. Completing them produces verified Sandbox Scores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Mapping your coach read to Sandbox challenges…
          </p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {items?.map((item) => (
          <div
            key={item.path_name}
            className="space-y-3 rounded-xl border bg-muted/20 p-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{item.path_name}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.reason}
              </p>
            </div>
            <ul className="space-y-2">
              {item.challenges.map((challenge) => (
                <li
                  key={challenge.node_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{challenge.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {challenge.title_am} · {challenge.sector} ·{" "}
                      <span className="font-mono">{challenge.node_id}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    render={<Link href={challenge.href} />}
                  >
                    Start challenge
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
