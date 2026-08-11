"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GradeLine } from "@/lib/ai/grade";
import { COMPETENCIES } from "@/lib/sandbox/competencies";
import { TONE } from "@/lib/tones";

export type GradeResponse = {
  overall: number;
  lines: GradeLine[];
  summary: string;
  source: "live" | "stub";
  badge: { badge_name: string };
  notified: number;
  optedOut: boolean;
};

function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // Ease-out so the number settles rather than stopping dead.
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function ScoreBar({ line, index }: { line: GradeLine; index: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(line.score), 120 + index * 90);
    return () => clearTimeout(timer);
  }, [line.score, index]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-200">
          {COMPETENCIES[line.competency].label}
        </span>
        <span className="font-mono text-xs text-slate-400">
          {line.score}
          <span className="text-slate-600">/100</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-verdant-500 transition-[width] duration-700 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{line.comment}</p>
    </div>
  );
}

export function ScoreReveal({
  result,
  nodeTitle,
  onRetry,
}: {
  result: GradeResponse;
  nodeTitle: string;
  onRetry: () => void;
}) {
  const overall = useCountUp(result.overall);

  return (
    <div className="space-y-4">
      <Card className="panel">
        <CardHeader>
          <CardTitle>Verified Sandbox Score</CardTitle>
          <CardDescription>{nodeTitle}</CardDescription>
          <CardAction>
            <Badge
              className={result.source === "live" ? TONE.info : TONE.neutral}
            >
              {result.source === "live" ? "AI graded" : "Graded offline"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-6">
            <div className="animate-score-rise">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-5xl font-semibold tracking-tight text-verdant-400">
                  {overall}
                </span>
                <span className="font-mono text-lg text-slate-600">/100</span>
              </div>
              <p className="label-caps mt-1">Weighted overall</p>
            </div>

            <div className="flex-1 rounded-lg border border-award-500/30 bg-award-500/5 p-3 text-center animate-badge-pop">
              <p className="text-[11px] uppercase tracking-widest text-award-400/70">
                Badge earned
              </p>
              <p className="mt-1 text-sm font-semibold text-award-400">
                {result.badge.badge_name}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            {result.summary}
          </p>

          <div className="space-y-4 border-t border-ink-700 pt-4">
            {result.lines.map((line, index) => (
              <ScoreBar key={line.competency} line={line} index={index} />
            ))}
          </div>

          {result.notified > 0 ? (
            <div className="rounded-lg border border-verdant-500/30 bg-verdant-500/5 p-3">
              <p className="text-xs leading-relaxed text-verdant-300">
                {result.notified} employer{result.notified === 1 ? "" : "s"} with a
                saved Role Skill Template just qualified you and were notified. They
                see your scores and gap analysis — never your conversations.
              </p>
            </div>
          ) : result.optedOut ? (
            <div className="rounded-lg border border-ink-600 bg-ink-850 p-3">
              <p className="text-xs leading-relaxed text-slate-400">
                Your score is saved but you are not discoverable, so no employer was
                notified. Turn on &ldquo;open to being matched&rdquo; when you are
                ready.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/sandbox"
              className="inline-flex h-10 items-center rounded-lg bg-verdant-500 px-4 text-sm font-medium text-ink-950 transition-colors hover:bg-verdant-400"
            >
              Back to the roadmap
            </Link>
            <Button variant="secondary" onClick={onRetry}>
              Try this challenge again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
