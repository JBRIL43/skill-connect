import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ChallengeWorkspace } from "@/components/sandbox/challenge-workspace";
import { Badge } from "@/components/ui/badge";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { weightedOverall } from "@/lib/data/derive";
import { resolveNode } from "@/lib/sandbox/resolve";
import { TONE } from "@/lib/tones";

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  const node = await resolveNode(nodeId);
  if (!node) notFound();

  const profile = await requireCurrentProfile();
  const isJobSeeker = profile.role === "job_seeker";

  const previousBest = isJobSeeker
    ? (await repo().listSandboxScores(profile.id))
        .filter((row) => row.node_id === node.id)
        .map((row) => weightedOverall(row.scores_json, node.rubric))
        .sort((a, b) => b - a)[0]
    : undefined;

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <Link
            href="/sandbox"
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to the roadmap
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                node.sector === "transition" ? TONE.info : TONE.neutral
              }
            >
              {node.sector === "transition"
                ? "Transition role challenge"
                : node.sector}
            </Badge>
            <Badge className={TONE.award}>{node.badgeName}</Badge>
            {previousBest !== undefined ? (
              <Badge className={TONE.verified}>
                Previous best {previousBest}/100
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {node.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{node.titleAm}</p>
          </div>
        </div>

        <ChallengeWorkspace
          node={node}
          canSubmit={isJobSeeker}
          blockedReason={
            isJobSeeker
              ? undefined
              : "You are signed in as an employer. Only job-seeker accounts can submit and be scored."
          }
        />
      </main>
    </div>
  );
}
