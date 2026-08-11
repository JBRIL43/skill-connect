import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { homePathForRole, requireProfile } from "@/lib/auth";
import { listOwnedTransitionPostings } from "@/lib/ai/handover-access";

import { InviteForm } from "./invite-form";

export default async function HandoverInvitePage() {
  const profile = await requireProfile();
  if (profile.role !== "sme") {
    redirect(homePathForRole(profile.role));
  }

  const postings = await listOwnedTransitionPostings(profile.id);

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="AI Handover Interview"
        description="Send a private interview link so an outgoing employee can capture recurring tasks before the Continuity Brief becomes usable."
      />
      <InviteForm
        postings={postings.map((posting) => ({
          id: posting.id,
          description: posting.description,
          status: posting.status,
          created_at: posting.created_at,
        }))}
      />
    </AppShell>
  );
}
