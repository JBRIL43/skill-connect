"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createHandoverInviteLink } from "./actions";

type PostingOption = {
  id: string;
  description: string | null;
  status: string;
  created_at: string;
};

export function InviteForm({ postings }: { postings: PostingOption[] }) {
  const [selectedId, setSelectedId] = useState(postings[0]?.id ?? "");
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (postings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No transition roles yet</CardTitle>
          <CardDescription>
            Mark a posting as a Transition Role first, then return here to send
            a private interview link to the outgoing employee.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function createLink() {
    if (!selectedId) return;
    setError(null);
    setInvitePath(null);
    setCopied(false);

    startTransition(async () => {
      const result = await createHandoverInviteLink(selectedId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("path" in result && result.path) {
        setInvitePath(result.path);
      }
    });
  }

  async function copyLink() {
    if (!invitePath) return;
    const absolute = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(absolute);
    setCopied(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite an outgoing employee</CardTitle>
        <CardDescription>
          Creates a private 72-hour link. The employee does not need a
          Skill-Connect account. Nothing is saved until they review and confirm
          the Continuity Brief.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Transition posting</span>
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {postings.map((posting) => (
              <option key={posting.id} value={posting.id}>
                {(posting.description?.trim() || "Untitled transition role").slice(
                  0,
                  80,
                )}{" "}
                · {posting.status}
              </option>
            ))}
          </select>
        </label>

        <Button type="button" disabled={pending || !selectedId} onClick={createLink}>
          {pending ? "Creating link…" : "Create invitation link"}
        </Button>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {invitePath ? (
          <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Share this link only with the outgoing employee. Expires in 72
              hours.
            </p>
            <code className="block break-all text-xs">{invitePath}</code>
            <Button type="button" size="sm" variant="outline" onClick={copyLink}>
              {copied ? "Copied" : "Copy full URL"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
