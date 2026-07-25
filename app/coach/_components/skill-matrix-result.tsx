import { CareerRecommendations } from "@/app/coach/_components/career-recommendations";
import { SkillRadar } from "@/app/coach/_components/skill-radar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { detectRadarLanguage } from "@/lib/ai/radar";
import type { SkillMatrixOutput } from "@/lib/ai/schemas";

const TECHNICAL_LABELS: Record<keyof SkillMatrixOutput["technical"], string> = {
  digital_literacy: "Digital literacy",
  ai_literacy: "AI literacy",
  data_handling: "Data handling",
  domain_tools: "Domain tools",
};

const HUMAN_LABELS: Record<keyof SkillMatrixOutput["human"], string> = {
  problem_solving: "Problem solving",
  adaptability: "Adaptability",
  communication: "Communication",
  collaboration: "Collaboration",
  empathy: "Empathy",
};

function ScoreList({
  title,
  scores,
  labels,
}: {
  title: string;
  scores: Record<string, number>;
  labels: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {Object.entries(scores).map(([key, value]) => (
          <li key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{labels[key] ?? key}</span>
              <span className="tabular-nums text-muted-foreground">
                {value}/100
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${value}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkillMatrixResult({
  matrix,
  readinessScore,
}: {
  matrix: SkillMatrixOutput;
  readinessScore: number;
}) {
  const language = detectRadarLanguage(matrix.raw_notes);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Your initial skill map</CardTitle>
            <Badge variant="secondary">Coach initial read</Badge>
          </div>
          <CardDescription>
            This is the coach&apos;s preliminary assessment, not a verified
            Sandbox Score. Verified scores come only from graded Sandbox
            challenges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            Placeholder readiness score:{" "}
            <span className="font-medium tabular-nums">{readinessScore}</span>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <SkillRadar matrix={matrix} language={language} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <ScoreList
              title="Technical competencies"
              scores={matrix.technical}
              labels={TECHNICAL_LABELS}
            />
            <ScoreList
              title="Human competencies"
              scores={matrix.human}
              labels={HUMAN_LABELS}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Coach notes</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {matrix.raw_notes}
            </p>
          </div>
        </CardContent>
      </Card>

      <CareerRecommendations matrix={matrix} />
    </div>
  );
}
