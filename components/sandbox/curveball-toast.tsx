"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { Curveball } from "@/lib/sandbox/reality";

export function CurveballToast({
  curveball,
  onDismiss,
  onRespond,
}: {
  curveball: Curveball;
  onDismiss: () => void;
  onRespond: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 120_000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-label="Incoming WhatsApp message"
      className="fixed right-4 bottom-24 z-[60] w-[min(22rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-4 duration-300 sm:right-6"
    >
      <div className="overflow-hidden rounded-2xl border border-emerald-700/40 bg-[#0b141a] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between bg-[#1f2c34] px-3 py-2">
          <div className="flex items-center gap-2">
            <MessageCircle aria-hidden className="size-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-200">WhatsApp</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            className="rounded p-1 text-slate-400 hover:text-slate-200"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-3">
          <p className="text-[11px] font-medium text-emerald-300">{curveball.sender}</p>
          <p className="rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-xs leading-relaxed text-slate-100">
            {curveball.message}
          </p>
          <p className="text-[10px] text-slate-500">
            Mid-task curveball — adapt your plan and tell the assistant what you would do.
          </p>
          <Button type="button" size="sm" className="w-full" onClick={onRespond}>
            Open chat and respond
          </Button>
        </div>
      </div>
    </div>
  );
}
