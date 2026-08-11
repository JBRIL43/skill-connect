import { Badge } from "@/components/ui/badge";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";

/**
 * Section 3's trust marker for the employer side. It is earned, not self-claimed:
 * only an admin can set company_profiles.verified, so this component takes the
 * flag rather than any editable field and renders nothing when it is false.
 */
export function AiForwardBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  if (!verified) return null;

  return (
    <Badge className={cn(TONE.award, className)}>AI-Forward Business</Badge>
  );
}
