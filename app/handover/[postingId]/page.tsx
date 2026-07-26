import { HandoverChat } from "@/app/handover/[postingId]/_components/handover-chat";
import {
  assertTokenForTransitionPosting,
  getReviewedBriefForPosting,
} from "@/lib/ai/handover-access";

export default async function HandoverInterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ postingId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { postingId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorCard
        title="Invitation required"
        message="Open the private link from the SME. This interview is not available without a valid invitation token."
      />
    );
  }

  let access: Awaited<ReturnType<typeof assertTokenForTransitionPosting>>;
  try {
    access = await assertTokenForTransitionPosting(postingId, token);
  } catch (error) {
    return (
      <ErrorCard
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
    return <ErrorCard title="Invitation unavailable" message={access.error} />;
  }

  let reviewed: Awaited<ReturnType<typeof getReviewedBriefForPosting>> = null;
  try {
    reviewed = await getReviewedBriefForPosting(postingId);
  } catch {
    reviewed = null;
  }

  if (reviewed) {
    return (
      <main className="mx-auto flex min-h-svh max-w-3xl items-center px-6 py-10">
        <div className="w-full space-y-3 rounded-2xl border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Continuity Brief already confirmed</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This transition role already has an employee-reviewed Continuity
            Brief. Ask the issuing SME if a new interview is needed.
          </p>
        </div>
      </main>
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

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-6 py-10">
      <div className="w-full space-y-3 rounded-2xl border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
