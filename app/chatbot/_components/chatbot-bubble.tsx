"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AskSkillConnect } from "./ask-skill-connect";

export function ChatbotBubble() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {open ? (
        <section
          id="ask-skill-connect-panel"
          role="dialog"
          aria-label="Ask Skill-Connect product help"
          className="mb-3 h-[min(36rem,calc(100svh-7rem))] w-[min(24rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <AskSkillConnect onClose={close} />
        </section>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls="ask-skill-connect-panel"
        aria-label={open ? "Close Ask Skill-Connect" : "Open Ask Skill-Connect"}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="relative">
          <MessageCircle aria-hidden="true" className="size-5" />
          <Sparkles
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 size-3"
          />
        </span>
        Ask Skill-Connect
      </button>
    </div>
  );
}
