import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * What a screen shows when it has nothing to show.
 *
 * On stage an empty table is indistinguishable from a broken one, so say which
 * it is and give the judge the next action.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
