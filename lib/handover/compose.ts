import { generateText } from "ai";

import { aiModel, isLiveAI } from "@/lib/ai/provider";
import type { RawInterview, SmePosting } from "@/lib/data/types";
import { composeBriefLocally } from "@/lib/handover/interview";

/**
 * Kept apart from the question script so the interview form can import the
 * questions without dragging the AI SDK into the client bundle with them.
 */
const BRIEF_SYSTEM = [
  "You turn a departing employee's handover interview into a short continuity brief for the employer.",
  "Write three to five sentences of plain prose, no headings and no bullet points.",
  "Use only what the interview says. Do not invent detail and do not speculate.",
  "Write around client names or individuals if any appear, using their role instead.",
].join(" ");

/**
 * Live prose when a key is configured, deterministic prose otherwise.
 *
 * A failed model call falls back rather than surfacing, because this sits in
 * the middle of the demo's longest flow and losing a typed interview to a
 * network blip is the worst possible outcome here.
 */
export async function composeBrief(
  interview: RawInterview,
  posting: SmePosting,
): Promise<string> {
  if (isLiveAI()) {
    try {
      const { text } = await generateText({
        model: aiModel(),
        system: BRIEF_SYSTEM,
        prompt: JSON.stringify({
          interview,
          posting: posting.description ?? "",
        }),
        temperature: 0.3,
      });
      const trimmed = text.trim();
      if (trimmed) return trimmed;
    } catch (error) {
      console.error("[handover] live brief failed, composing locally", error);
    }
  }

  return composeBriefLocally(interview, posting);
}
