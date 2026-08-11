"use client";

import { useTransition } from "react";

import { setDiscoverable } from "@/app/actions/candidate";
import { cn } from "@/lib/utils";

export function DiscoverabilityToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void setDiscoverable(!enabled);
        })
      }
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        enabled
          ? "border-verdant-500/40 bg-verdant-500/5"
          : "border-ink-600 bg-ink-850",
        pending && "opacity-60",
      )}
    >
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          enabled ? "bg-verdant-500" : "bg-ink-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-ink-950 transition-all",
            enabled ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      <span>
        <span className="block text-xs font-medium text-slate-200">
          {enabled ? "Open to being matched" : "Not discoverable"}
        </span>
        <span className="block text-[11px] text-slate-500">
          {enabled
            ? "Employers with a matching role can see your scores"
            : "Your scores stay private to you"}
        </span>
      </span>
    </button>
  );
}
