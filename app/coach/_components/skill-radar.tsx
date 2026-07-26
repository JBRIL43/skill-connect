import {
  toRadarAxes,
  type RadarLanguage,
} from "@/lib/ai/radar";
import type { SkillMatrixOutput } from "@/lib/ai/schemas";

const SIZE = 520;
const CENTER = SIZE / 2;
const CHART_RADIUS = 155;
const LABEL_RADIUS = 205;
const RINGS = [0.25, 0.5, 0.75, 1] as const;

type Point = { x: number; y: number };

function pointAt(index: number, count: number, radius: number): Point {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function pointsAttribute(points: Point[]) {
  return points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function textAnchor(x: number): "start" | "middle" | "end" {
  if (Math.abs(x - CENTER) < 8) return "middle";
  return x > CENTER ? "start" : "end";
}

export function SkillRadar({
  matrix,
  language = "en",
}: {
  matrix: SkillMatrixOutput;
  language?: RadarLanguage;
}) {
  const axes = toRadarAxes(matrix, language);
  const count = axes.length;
  const outerPoints = axes.map((_, index) =>
    pointAt(index, count, CHART_RADIUS),
  );
  const valuePoints = axes.map(({ score }, index) =>
    pointAt(index, count, CHART_RADIUS * (Math.max(0, score) / 100)),
  );

  const accessibleSummary = axes
    .map(({ label, score }) => `${label}: ${score} out of 100`)
    .join(", ");

  return (
    <figure className="mx-auto w-full max-w-xl">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Coach initial skill radar. ${accessibleSummary}`}
        className="h-auto w-full overflow-visible"
      >
        <g aria-hidden="true">
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              points={pointsAttribute(
                axes.map((_, index) =>
                  pointAt(index, count, CHART_RADIUS * ring),
                ),
              )}
              fill="none"
              stroke="var(--border)"
              strokeWidth={ring === 1 ? 1.5 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {outerPoints.map((point, index) => (
            <line
              key={axes[index].key}
              x1={CENTER}
              y1={CENTER}
              x2={point.x}
              y2={point.y}
              stroke="var(--border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g
          className="origin-center animate-in fade-in zoom-in-95 duration-700"
          aria-hidden="true"
        >
          <polygon
            points={pointsAttribute(valuePoints)}
            fill="var(--primary)"
            fillOpacity={0.16}
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {valuePoints.map((point, index) => (
            <circle
              key={axes[index].key}
              cx={point.x}
              cy={point.y}
              r={4}
              fill="var(--background)"
              stroke="var(--primary)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g
          fill="var(--foreground)"
          fontSize={12}
          style={{
            fontFamily:
              "var(--font-noto-ethiopic), var(--font-geist-sans), sans-serif",
          }}
        >
          {axes.map((axis, index) => {
            const point = pointAt(index, count, LABEL_RADIUS);
            const anchor = textAnchor(point.x);

            return (
              <text
                key={axis.key}
                x={point.x}
                y={point.y}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                <tspan x={point.x} fontWeight={500}>
                  {axis.label}
                </tspan>
                <tspan
                  x={point.x}
                  dy={16}
                  fill="var(--muted-foreground)"
                  fontVariant="tabular-nums"
                >
                  {axis.score}/100
                </tspan>
              </text>
            );
          })}
        </g>
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">
        {language === "am"
          ? "ይህ የአሰልጣኙ የመጀመሪያ ግምገማ ነው፤ የተረጋገጠ የSandbox ውጤት አይደለም።"
          : "Coach-inferred strengths from this intake, not verified Sandbox Scores."}
      </figcaption>
    </figure>
  );
}
