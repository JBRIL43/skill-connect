"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RawInterviewJson } from "@/lib/ai/handover";

export function BriefReview({
  postingId,
  token,
  initialBrief,
  interview,
  onBack,
}: {
  postingId: string;
  token: string;
  initialBrief: string;
  interview: RawInterviewJson;
  onBack: () => void;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function confirm() {
    const trimmed = brief.trim();
    if (trimmed.length < 40 || saving || confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/handover/${postingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          generated_brief: trimmed,
          raw_interview_json: interview,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        reviewed_by_employee?: boolean;
      } | null;

      if (!response.ok || !payload?.reviewed_by_employee) {
        throw new Error(payload?.error ?? "Unable to confirm Continuity Brief");
      }

      setConfirmed(true);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Unable to confirm Continuity Brief",
      );
    } finally {
      setSaving(false);
    }
  }

  if (confirmed) {
    return (
      <div className="space-y-4 rounded-2xl border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Continuity Brief confirmed</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Thank you. The issuing SME can now use the reviewed Continuity Brief.
          The raw interview stays private and is not shown to candidates or
          other companies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-background p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Review and redact</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Edit out client names, personal names, or internal specifics before
          confirming. Nothing is saved until you confirm.
        </p>
      </div>

      <Textarea
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        rows={18}
        className="min-h-80 font-mono text-sm"
        aria-label="Continuity Brief draft"
        disabled={saving}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || brief.trim().length < 40}
          onClick={() => void confirm()}
        >
          {saving ? "Saving…" : "Confirm Continuity Brief"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onBack}
        >
          Back to interview
        </Button>
      </div>
    </div>
  );
}
