import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import type { MatchStatus } from "@/lib/data/types";
import { competencyLabel } from "@/lib/sandbox/competencies";
import { TONE, type Tone } from "@/lib/tones";

import { HandoverChallengeForm } from "./handover-controls";
import { MatchStatusForm, RunMatchForm } from "./match-controls";

const STATUS_TONE: Record<MatchStatus, Tone> = {
  suggested: "neutral",
  shortlisted: "info",
  hired: "verified",
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  suggested: "Suggested",
  shortlisted: "Shortlisted",
  hired: "Hired",
};

export default async function PostingMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  const posting = await repo().getPosting(id);
  if (!posting) notFound();
  // Owning the posting is checked here as well as in the actions, so a guessed
  // URL cannot read another company's shortlist.
  if (posting.sme_id !== profile.id) redirect("/matcher");

  const template = posting.template_id
    ? await repo().getTemplate(posting.template_id)
    : null;

  const [matches, brief, briefStatus] = await Promise.all([
    repo().listMatchesForPosting(posting.id),
    repo().getBriefByPosting(posting.id),
    // Two booleans, no content: enough to offer the interview without this page
    // ever holding text the employee has not approved.
    repo().getBriefStatus(posting.id),
  ]);

  const thresholds = Object.entries(template?.thresholds_json ?? {});

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <Link
            href="/matcher"
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to matching
          </Link>

          <div className="space-y-2">
            <span className="label-caps">Matched candidates</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {template?.role_name ?? "Untitled role"}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              {posting.description ?? "No posting description."}
            </p>
          </div>

          {thresholds.length ? (
            <div className="flex flex-wrap gap-2">
              {thresholds.map(([key, minimum]) => (
                <Badge key={key} className={TONE.neutral}>
                  {competencyLabel(key)}
                  <span className="font-mono text-slate-500">min {minimum}</span>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <RunMatchForm postingId={posting.id} hasResults={matches.length > 0} />

        {/* getBriefByPosting returns reviewed briefs only, in both adapters, so
            an unreviewed one is absent here rather than rendered in a hidden
            state. Master checklist: "Continuity Briefs are unreachable until
            reviewed_by_employee = true." */}
        {brief ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>Score candidates on this actual job</CardTitle>
              <CardDescription>
                The person leaving this role recorded a handover interview and
                approved it for sharing. It can become a scored challenge, so a
                replacement is measured on the real work instead of a generic
                rubric.
              </CardDescription>
              <CardAction>
                <Badge className={TONE.verified}>Approved by employee</Badge>
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-4">
              {brief.generated_brief ? (
                <div className="panel-muted p-3">
                  <p className="label-caps">Approved continuity brief</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    {brief.generated_brief}
                  </p>
                </div>
              ) : null}

              <HandoverChallengeForm
                postingId={posting.id}
                existingNodeId={brief.custom_node_id}
              />
            </CardContent>
          </Card>
        ) : posting.is_transition_role ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>
                {briefStatus.exists
                  ? "The handover is waiting on the employee"
                  : "Capture what the person leaving knows"}
              </CardTitle>
              <CardDescription>
                {briefStatus.exists
                  ? "An interview has been recorded, but the brief has not been approved for sharing yet. It stays hidden here until it is."
                  : "Someone is leaving this role and taking the undocumented half of it with them. A short interview turns that into a brief, and the brief into a challenge that scores replacements on the real job."}
              </CardDescription>
              <CardAction>
                <Badge className={briefStatus.exists ? TONE.award : TONE.neutral}>
                  {briefStatus.exists ? "Awaiting approval" : "Not started"}
                </Badge>
              </CardAction>
            </CardHeader>

            <CardContent>
              <Link
                href={`/handover/${posting.id}`}
                className="text-sm text-verdant-400 hover:text-verdant-300"
              >
                {briefStatus.exists
                  ? "Reopen the handover interview →"
                  : "Start the handover interview →"}
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {matches.length === 0 ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>No candidates yet</CardTitle>
              <CardDescription>
                Run matching to score every opted-in candidate against this bar.
                Only those clearing every threshold appear — a near miss is not a
                match.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match, index) => {
              return (
                <Card key={match.id} className="panel">
                  <CardHeader>
                    <CardTitle className="flex items-baseline gap-3">
                      <span className="font-mono text-2xl text-verdant-400">
                        {match.match_score ?? 0}
                      </span>
                      {/* Derived by 0006's trigger: their name only while they
                          are discoverable, a stable letter otherwise. */}
                      <span>
                        {match.candidate_label ?? `Candidate ${index + 1}`}
                      </span>
                    </CardTitle>
                    <CardDescription>Match Score out of 100</CardDescription>
                    <CardAction>
                      <Badge className={TONE[STATUS_TONE[match.status]]}>
                        {STATUS_LABEL[match.status]}
                      </Badge>
                    </CardAction>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="panel-muted p-3">
                      <p className="label-caps">Gap analysis</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {match.gap_analysis ??
                          "No gap analysis was generated for this match."}
                      </p>
                    </div>

                    <MatchStatusForm
                      matchId={match.id}
                      postingId={posting.id}
                      status={match.status}
                    />
                  </CardContent>
                </Card>
              );
            })}

            <p className="text-[11px] leading-relaxed text-slate-500">
              You see verified scores and gap analysis only. Intake
              conversations, skill matrices, and unreviewed handover briefs are
              never shared with an employer.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
