"use client";

import Link from "next/link";
import { useState } from "react";

import { generateReadinessReport } from "@/app/readiness/actions";
import {
  READINESS_QUESTIONS,
  type ReadinessReport,
} from "@/app/readiness/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TONE } from "@/lib/tones";

type Language = "en" | "am";

const LEVEL_LABEL: Record<ReadinessReport["readiness_level"], string> = {
  emerging: "Emerging",
  developing: "Developing",
  ready: "Ready",
};

const LEVEL_LABEL_AM: Record<ReadinessReport["readiness_level"], string> = {
  emerging: "ጀማሪ",
  developing: "በማደግ ላይ",
  ready: "ዝግጁ",
};

const LEVEL_TONE: Record<ReadinessReport["readiness_level"], string> = {
  emerging: TONE.neutral,
  developing: TONE.award,
  ready: TONE.verified,
};

export function ReadinessForm({ isSme }: { isSme: boolean }) {
  const [language, setLanguage] = useState<Language>("en");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReadinessReport | null>(null);

  const isEn = language === "en";
  const answered = READINESS_QUESTIONS.filter(
    (q) => (answers[q.id] ?? "").trim().length > 0,
  ).length;
  const canSubmit = answered >= 3 && !loading && !report;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const result = await generateReadinessReport(answers);
      setReport(result.report);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate the report.",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAnswers({});
    setReport(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Language toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={isEn ? "default" : "outline"}
          onClick={() => setLanguage("en")}
        >
          English
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!isEn ? "default" : "outline"}
          onClick={() => setLanguage("am")}
        >
          አማርኛ
        </Button>
      </div>

      {report ? (
        <ReportCard
          report={report}
          isEn={isEn}
          isSme={isSme}
          onReset={reset}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {isEn
                ? "AI Readiness Snapshot"
                : "የAI ዝግጁነት ፈጣን ምዘና"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Answer at least 3 questions. You will get an instant, specific report — no account needed."
                : "ቢያንስ 3 ጥያቄዎችን ይመልሱ። ወዲያውኑ ዝርዝር ሪፖርት ያገኛሉ — መለያ አያስፈልግም።"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {READINESS_QUESTIONS.map((q, index) => (
                <div key={q.id} className="space-y-1.5">
                  <label
                    htmlFor={`q-${q.id}`}
                    className="block text-sm font-medium"
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    {isEn ? q.label : q.labelAm}
                  </label>
                  <Textarea
                    id={`q-${q.id}`}
                    rows={2}
                    placeholder={isEn ? q.placeholder : q.placeholderAm}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    disabled={loading}
                  />
                </div>
              ))}

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!canSubmit}>
                  {loading
                    ? isEn
                      ? "Generating…"
                      : "በመፍጠር ላይ…"
                    : isEn
                      ? "Get my snapshot"
                      : "ምዘናዬን አግኝ"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isEn
                    ? `${answered} of ${READINESS_QUESTIONS.length} answered`
                    : `${answered} / ${READINESS_QUESTIONS.length} ተመልሷል`}
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportCard({
  report,
  isEn,
  isSme,
  onReset,
}: {
  report: ReadinessReport;
  isEn: boolean;
  isSme: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Score header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>
              {isEn ? "Your AI Readiness Report" : "የAI ዝግጁነት ሪፖርትዎ"}
            </CardTitle>
            <Badge className={LEVEL_TONE[report.readiness_level]}>
              {isEn
                ? LEVEL_LABEL[report.readiness_level]
                : LEVEL_LABEL_AM[report.readiness_level]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Score bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isEn ? "Readiness score" : "የዝግጁነት ነጥብ"}
              </span>
              <span className="font-semibold tabular-nums text-primary">
                {report.readiness_score}
                <span className="font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${report.readiness_score}%` }}
              />
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {report.summary}
          </p>
        </CardContent>
      </Card>

      {/* Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isEn
              ? "3 tasks an AI-fluent hire could take off your plate this month"
              : "AI-ን የሚያውቅ ቀጣሪ ይህ ወር ሊረዳዎት የሚችሉ 3 ተግባራት"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.opportunities.map((opp, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{opp.task}</p>
                <p className="text-sm text-muted-foreground">{opp.impact}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next step */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">
            {isEn ? "Your next step" : "ቀጣይ እርምጃዎ"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6">{report.next_step}</p>
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        {isSme ? (
          <Button asChild>
            <Link href="/matcher/templates/new">
              {isEn ? "Build a Role Skill Template" : "የሙያ ክህሎት ቅርጸት ይፍጠሩ"}
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/signup">
              {isEn ? "Create a free account" : "ነጻ መለያ ይፍጠሩ"}
            </Link>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onReset}>
          {isEn ? "Start over" : "እንደገና ጀምር"}
        </Button>
      </div>
    </div>
  );
}
