import { redirect } from "next/navigation";

import { CoachChat } from "@/app/coach/_components/coach-chat";
import { AppHeader } from "@/components/app-header";
import { homePathForRole, requireProfile } from "@/lib/auth";

export default async function CoachPage() {
  const profile = await requireProfile();

  if (profile.role !== "job_seeker") {
    redirect(homePathForRole(profile.role));
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <CoachChat />
      </main>
    </div>
  );
}
