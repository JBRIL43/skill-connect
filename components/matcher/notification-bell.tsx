import Link from "next/link";

/**
 * The count is what makes the Pillar 3 demo beat land: a candidate finishes a
 * challenge on one screen and this number moves on the other.
 */
export function NotificationBell({ unseen }: { unseen: number }) {
  return (
    <Link
      href="/matcher/notifications"
      aria-label={
        unseen === 0
          ? "Notifications"
          : `Notifications, ${unseen} unread candidate${unseen === 1 ? "" : "s"}`
      }
      className="relative inline-flex size-9 items-center justify-center rounded-lg border border-ink-600 text-slate-300 transition-colors hover:border-verdant-500/40 hover:text-slate-100"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        className="size-4"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>

      {unseen > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-verdant-500 px-1 font-mono text-[10px] font-semibold text-ink-950">
          {unseen > 9 ? "9+" : unseen}
        </span>
      ) : null}
    </Link>
  );
}
