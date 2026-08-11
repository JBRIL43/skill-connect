import { AppHeader } from "@/components/app-header";
import { DiscoverabilityToggle } from "@/components/sandbox/discoverability-toggle";
import { SandboxNodeTree } from "@/components/sandbox/node-tree";
import { Badge } from "@/components/ui/badge";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { bestScores, weightedOverall } from "@/lib/data/derive";
import { COMPETENCIES } from "@/lib/sandbox/competencies";
import { getStaticNode } from "@/lib/sandbox/nodes";
import { listAllNodes } from "@/lib/sandbox/resolve";
import { buildSandboxTree } from "@/lib/sandbox/tree";
import { TONE } from "@/lib/tones";

export default async function SandboxPage() {
  const [profile, nodes] = await Promise.all([
    requireCurrentProfile(),
    listAllNodes(),
  ]);
  const isJobSeeker = profile.role === "job_seeker";

  const [scores, badges] = isJobSeeker
    ? await Promise.all([
        repo().listSandboxScores(profile.id),
        repo().listBadges(profile.id),
      ])
    : [[], []];

  const progress = new Map<
    string,
    { overallScore: number; badgeName: string | null }
  >();

  for (const row of scores) {
    const node = nodes.find((item) => item.id === row.node_id);
    if (!node) continue;
    const overall = weightedOverall(row.scores_json, node.rubric);
    const existing = progress.get(row.node_id);
    if (existing && existing.overallScore >= overall) continue;
    progress.set(row.node_id, {
      overallScore: overall,
      badgeName:
        badges.find((badge) => badge.node_id === row.node_id)?.badge_name ??
        null,
    });
  }

  const { nodes: treeNodes, edges } = buildSandboxTree(nodes, progress);
  const standing = bestScores(scores);
  const standingEntries = Object.entries(standing).sort(
    ([, a], [, b]) => (b ?? 0) - (a ?? 0),
  );

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="label-caps">Pillar 2</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Walk-With-AI Sandbox
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Every challenge is a real Ethiopian business problem you solve with
              an AI assistant beside you. You can read the rubric before you
              start, and the score it produces is what employers match against.
            </p>
          </div>

          {isJobSeeker ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Badge className={TONE.verified}>
                  {progress.size} challenge{progress.size === 1 ? "" : "s"}{" "}
                  scored
                </Badge>
                <Badge className={TONE.award}>
                  {badges.length} badge{badges.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <DiscoverabilityToggle enabled={profile.opt_in_discoverable} />
            </div>
          ) : null}
        </header>

        <SandboxNodeTree nodes={treeNodes} edges={edges} />

        {standingEntries.length ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Your standing scores
            </h2>
            <p className="text-xs text-slate-500">
              Best result per competency across every challenge. Employers
              compare these against their role thresholds.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {standingEntries.map(([key, value]) => {
                const meta = COMPETENCIES[key as keyof typeof COMPETENCIES];
                return (
                  <div key={key} className="panel-muted p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {meta.label}
                      </span>
                      <span className="font-mono text-sm text-verdant-400">
                        {value}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {meta.labelAm}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {isJobSeeker && badges.length ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Verified capability badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <Badge key={badge.id} className={TONE.award}>
                  {badge.badge_name}
                  <span className="text-award-400/60">
                    {getStaticNode(badge.node_id)?.sector ?? "transition"}
                  </span>
                </Badge>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
