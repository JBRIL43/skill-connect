import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { HandoverChat } from "@/app/handover/[postingId]/_components/handover-chat";
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
import {
  assertTokenForTransitionPosting,
  getReviewedBriefForPosting,
} from "@/lib/ai/handover-access";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import type { RawInterview } from "@/lib/data/types";
import {
  INTERVIEW_QUESTIONS,
  type InterviewAnswers,
} from "@/lib/handover/interview";
import { normalizeInterview } from "@/lib/handover/normalize";
import { TONE } from "@/lib/tones";

import { InterviewForm } from "./interview-form";
import { ReopenForm, ReviewForm } from "./review-form";

/**
 * Two doors into the same room, because Dev 2 and Dev 3 built this route at the
 * same time and each solved a problem the other did not.
 *
 * With a token: Dev 2's flow. The departing employee holds no account, which is
 * what Section 9 actually describes, and their signed link is the only correct
 * answer to that. Needs an LLM key and a signing secret.
 *
 * Without one: Dev 3's flow. The owning SME opens it and hands over the screen.
 * Narrower, but it runs with no key, no secret and no network, which is what
 * the demo has to survive.
 *
 * Both end at the same place — a continuity brief the employee approved — so
 * everything downstream is indifferent to which door was used.
 */
export default async function HandoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ postingId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { postingId } = await params;
  const { token } = await searchParams;

  if (token) return invitedInterview(postingId, token);
  return ownerInterview(postingId);
}

// ---------------------------------------------------------------- invited

async function invitedInterview(postingId: string, token: string) {
  let access: Awaited<ReturnType<typeof assertTokenForTransitionPosting>>;
  try {
    access = await assertTokenForTransitionPosting(postingId, token);
  } catch (error) {
    return (
      <Notice
        title="Handover temporarily unavailable"
        message={
          error instanceof Error
            ? error.message
            : "Server configuration is incomplete for handover interviews."
        }
      />
    );
  }

  if (!access.ok) {
    return <Notice title="Invitation unavailable" message={access.error} />;
  }

  let reviewed: Awaited<ReturnType<typeof getReviewedBriefForPosting>> = null;
  try {
    reviewed = await getReviewedBriefForPosting(postingId);
  } catch {
    reviewed = null;
  }

  if (reviewed) {
    return (
      <Notice
        title="Continuity brief already confirmed"
        message="This transition role already has an employee-reviewed continuity brief. Ask the SME who invited you whether a new interview is needed."
      />
    );
  }

  return (
    <main className="mx-auto min-h-svh max-w-3xl px-6 py-10">
      <HandoverChat
        postingId={postingId}
        token={token}
        postingDescription={access.posting.description}
      />
    </main>
  );
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-6 py-10">
      <Card className="panel w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

// ------------------------------------------------------------------ owner

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

async function ownerInterview(postingId: string) {
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
  // Normalized so a brief recorded through Dev 2's token flow reloads into
  // these fields too, rather than showing the SME an empty interview.
  const raw = draft
    ? normalizeInterview(draft.raw_interview_json, draft.generated_brief)
    : null;

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
            <p className="text-xs leading-relaxed text-slate-500">
              If they would rather do it in their own time,{" "}
              <Link
                href="/handover/invite"
                className="text-verdant-400 hover:text-verdant-300"
              >
                send them a private link
              </Link>{" "}
              instead and they can answer without an account.
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
                <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">
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
            <CardTitle>{draft ? "Change an answer" : "The interview"}</CardTitle>
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
