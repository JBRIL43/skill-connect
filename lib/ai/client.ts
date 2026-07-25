"use client";

import type {
  ConversationMessage,
  ConversationMode,
} from "./schemas";

export async function streamConversationFromApi({
  mode,
  messages,
  signal,
  onText,
}: {
  mode: ConversationMode;
  messages: ConversationMessage[];
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ mode, messages }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (response.redirected || contentType.includes("text/html")) {
    throw new Error("Sign in to use Ask Skill-Connect.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "AI response failed");
  }

  if (!response.body) {
    throw new Error("No response stream returned");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }

  return text;
}
