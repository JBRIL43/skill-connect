"use client";

import { useRef, useState } from "react";

import {
  ScoreReveal,
  type GradeResponse,
} from "@/components/sandbox/score-reveal";
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
import type { AssistTurn } from "@/lib/ai/grade";
import type { SandboxMode } from "@/lib/data/types";
import { COMPETENCIES } from "@/lib/sandbox/competencies";
import {
  MIN_SUBMISSION_CHARS,
  type SandboxNode,
} from "@/lib/sandbox/nodes";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function ChallengeWorkspace({
  node,
  canSubmit,
  blockedReason,
}: {
  node: SandboxNode;
  canSubmit: boolean;
  blockedReason?: string;
}) {
  const [mode, setMode] = useState<SandboxMode>("standard");
  const [transcript, setTranscript] = useState<AssistTurn[]>([
    {
      role: "assistant",
      content: `I am here to help you produce the deliverable, not to hand you an answer. Tell me what you already know about this situation and we will build it together.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [submission, setSubmission] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const tooShort = submission.trim().length < MIN_SUBMISSION_CHARS;

  async function send() {
    const message = draft.trim();
    if (!message || assisting) return;

    const next: AssistTurn[] = [...transcript, { role: "user", content: message }];
    setTranscript(next);
    setDraft("");
    setAssisting(true);
    setError(null);

    try {
      const response = await fetch("/api/sandbox/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, mode, transcript: next }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Assistant unavailable");

      setTranscript([...next, { role: "assistant", content: payload.reply }]);
      requestAnimationFrame(() =>
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assistant unavailable");
    } finally {
      setAssisting(false);
    }
  }

  async function submit() {
    if (tooShort || grading) return;
    setGrading(true);
    setError(null);

    try {
      const response = await fetch("/api/sandbox/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          mode,
          submission,
          transcript,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Grading failed");

      setResult(payload as GradeResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Grading failed");
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4 lg:sticky lg:top-20">
        <Card className="panel">
          <CardHeader>
            <CardTitle>The situation</CardTitle>
            <CardAction>
              <span className="text-[11px] text-slate-500">
                ~{node.estimatedMinutes} min
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-300">
              {node.scenario}
            </p>
            <div className="panel-muted p-3">
              <p className="label-caps">What you submit</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {node.deliverable}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>Rubric</CardTitle>
            <CardDescription>
              Visible before you start — this is exactly what is scored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {node.rubric.map((line) => (
              <div key={line.competency} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {COMPETENCIES[line.competency].label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {Math.round(line.weight * 100)}%
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  {line.criteria}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {node.pressureSimulationAllowed ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>Practice mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    { value: "standard", label: "Supportive coaching" },
                    { value: "pressure_simulation", label: "Pressure simulation" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors",
                      mode === option.value
                        ? "border-verdant-500/50 bg-verdant-500/10 text-verdant-300"
                        : "border-ink-600 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {mode === "pressure_simulation"
                  ? "The assistant will be blunt about the work — deadlines, gaps, what would fail with a real customer. It stays critical of the work, never of you, and you can switch back to coaching at any time."
                  : "Optional. Pressure simulation rehearses a demanding first week before a real interview. It is never the default."}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {result ? (
        <ScoreReveal
          result={result}
          nodeTitle={node.title}
          onRetry={() => {
            setResult(null);
            setSubmission("");
          }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="panel">
            <CardHeader>
              <CardTitle>Work with the AI assistant</CardTitle>
              <CardDescription>
                How you direct the assistant is part of the score, not a
                shortcut around it.
              </CardDescription>
              {mode === "pressure_simulation" ? (
                <CardAction>
                  <Badge className={TONE.gap}>Pressure mode</Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {transcript.map((turn, index) => (
                  <div
                    key={index}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      turn.role === "assistant"
                        ? "bg-ink-850 text-slate-300"
                        : "ml-auto max-w-[85%] bg-verdant-500/10 text-verdant-100",
                    )}
                  >
                    {turn.content}
                  </div>
                ))}
                {assisting ? (
                  <p className="px-3 text-[11px] text-slate-500">
                    Assistant is thinking…
                  </p>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask for a draft, push back on it, or paste what you have…"
                  className="field"
                />
                <Button onClick={() => void send()} disabled={assisting || !draft.trim()}>
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="panel">
            <CardHeader>
              <CardTitle>Your submission</CardTitle>
              <CardDescription>
                Paste the finished deliverable. This is what gets graded.
              </CardDescription>
              <CardAction>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    tooShort ? "text-slate-600" : "text-verdant-400",
                  )}
                >
                  {submission.trim().length} chars
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={submission}
                onChange={(event) => setSubmission(event.target.value)}
                rows={9}
                placeholder="The catalog message, the sheet structure, the plan — whatever the brief asked for."
                className="field resize-y font-mono text-xs leading-relaxed"
              />

              {error ? (
                <p className="text-xs text-gap-400">{error}</p>
              ) : null}

              {!canSubmit ? (
                <p className="text-xs text-slate-400">
                  {blockedReason ??
                    "Only job-seeker accounts can submit and be scored."}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => void submit()}
                  disabled={!canSubmit || tooShort || grading}
                >
                  {grading ? "Grading…" : "Submit for grading"}
                </Button>
                <p className="text-[11px] text-slate-500">
                  {tooShort
                    ? `At least ${MIN_SUBMISSION_CHARS} characters before grading.`
                    : "Graded against the rubric on the left, then saved to your profile."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
