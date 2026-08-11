import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/**
 * The frame every signed-in page renders inside — header, width, padding.
 *
 * Three developers build three pillars in parallel, so the only thing keeping
 * the demo from looking like three separate apps is that all of them wrap in
 * this. Reach for it before hand-rolling a <main>.
 */
export function AppShell({
  profile,
  children,
  className,
}: {
  profile: Profile;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <AppHeader profile={profile} />
      <main
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
