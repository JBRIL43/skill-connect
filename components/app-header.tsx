import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types/database";

const ROLE_LABEL: Record<Profile["role"], string> = {
  job_seeker: "Job seeker",
  sme: "Company",
  admin: "Admin",
};

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Skill-Connect <span className="text-muted-foreground">Ethiopia</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.full_name ?? "Unnamed"}
          </span>
          <Badge variant="secondary">{ROLE_LABEL[profile.role]}</Badge>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
