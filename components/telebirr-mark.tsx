import { cn } from "@/lib/utils";

/**
 * The telebirr wordmark, set the way Ethio Telecom sets it: all lowercase, white
 * on their green.
 *
 * Used by the mock checkout so the fallback in Section 16 is visually convincing
 * rather than obviously a placeholder. It is only ever chrome -- the "this is a
 * demo" labelling that Section 14 asks for sits next to it, never inside it.
 */
export function TelebirrMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-[#00A651] px-2 py-1 text-sm font-semibold lowercase tracking-tight text-white",
        className,
      )}
    >
      telebirr
    </span>
  );
}
