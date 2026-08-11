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
  endpoint = "/api/ai/chat",
  extraBody,
}: {
  mode: ConversationMode;
  messages: ConversationMessage[];
  signal?: AbortSignal;
  onText: (text: string) => void;
  endpoint?: string;
  extraBody?: Record<string, unknown>;
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ mode, messages, ...extraBody }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (response.redirected || contentType.includes("text/html")) {
    throw new Error("Sign in to continue this conversation.");
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
