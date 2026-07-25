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
import type { RawInterview } from "@/lib/data/types";
import {
  INTERVIEW_QUESTIONS,
  type InterviewAnswers,
} from "@/lib/handover/interview";
import { TONE } from "@/lib/tones";

import { InterviewForm } from "./interview-form";
import { ReopenForm, ReviewForm } from "./review-form";

/** Reverses toRawInterview so a saved interview reloads into its own fields. */
function toAnswers(interview: RawInterview | null): InterviewAnswers {
  if (!interview) return {};

  const answers: InterviewAnswers = {};
  for (const question of INTERVIEW_QUESTIONS) {
    const value = interview[question.id];
    if (Array.isArray(value)) answers[question.id] = value.join("\n");
    else if (typeof value === "string") answers[question.id] = value;
  }
  return answers;
}

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ postingId: string }>;
}) {
  const { postingId } = await params;

  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  const posting = await repo().getPosting(postingId);
  if (!posting) notFound();
  // Ownership is checked here and again in every action. This page is the only
  // screen in the app allowed to render pre-redaction text, so a guessed URL
  // must not reach it.
  if (posting.sme_id !== profile.id) redirect("/matcher");

  const template = posting.template_id
    ? await repo().getTemplate(posting.template_id)
    : null;

  const draft = await repo().getBriefDraft(postingId);
  const approved = Boolean(draft?.reviewed_by_employee);
  const raw = (draft?.raw_interview_json as RawInterview | null) ?? null;

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <Link
            href={`/matcher/postings/${postingId}`}
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to the posting
          </Link>

          <div className="space-y-2">
            <span className="label-caps">Handover interview</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {template?.role_name ?? "Untitled role"}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Hand this screen to the person leaving. What they know is the job
              description nobody ever wrote down — this captures it while they
              are still here, and turns it into a challenge their replacement
              can actually be scored on.
            </p>
          </div>
        </div>

        {approved ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>Approved and shared</CardTitle>
              <CardDescription>
                This brief is now visible on the posting, and can be turned into
                a scored challenge from there.
              </CardDescription>
              <CardAction>
                <Badge className={TONE.verified}>Approved by employee</Badge>
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="panel-muted p-3">
                <p className="text-xs leading-relaxed text-slate-300">
                  {draft?.generated_brief}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ReopenForm postingId={postingId} />
                <Link
                  href={`/matcher/postings/${postingId}`}
                  className="text-sm text-verdant-400 hover:text-verdant-300"
                >
                  Build the challenge →
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : draft ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>Read this before anyone else does</CardTitle>
              <CardDescription>
                Written from the answers just given. Nobody can see it yet — not
                the employer, not a candidate — until it is approved below.
              </CardDescription>
              <CardAction>
                <Badge className={TONE.award}>Not shared yet</Badge>
              </CardAction>
            </CardHeader>

            <CardContent>
              <ReviewForm
                postingId={postingId}
                draft={draft.generated_brief ?? ""}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="panel">
          <CardHeader>
            <CardTitle>
              {draft ? "Change an answer" : "The interview"}
            </CardTitle>
            <CardDescription>
              {draft
                ? "Rewriting an answer rewrites the brief above, and it goes back to needing approval."
                : "Six questions. Answer them the way you would explain the job to the person taking it over."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <InterviewForm
              postingId={postingId}
              initialAnswers={toAnswers(raw)}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
