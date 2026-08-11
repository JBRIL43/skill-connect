"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { BriefReview } from "@/app/handover/[postingId]/_components/brief-review";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamConversationFromApi } from "@/lib/ai/client";
import type { RawInterviewJson } from "@/lib/ai/handover";
import type { ConversationMessage } from "@/lib/ai/schemas";

type Language = "en" | "am";
type UiMessage = ConversationMessage & { id: string };

const COPY = {
  en: {
    starter:
      "Hello! This is a private handover interview. I will ask about recurring tasks, tools, decision points, shortcuts, and who you coordinate with by role. Avoid client or personal names. When you have shared enough, use Create Continuity Brief.",
    create: "Create Continuity Brief",
    creating: "Creating brief…",
    placeholder: "Share your answer…",
    thinking: "Thinking…",
    enough:
      "Share a few concrete answers first, then create the Continuity Brief.",
  },
  am: {
    starter:
      "\u1230\u120b\u121d\u1362 \u12ed\u1205 \u12e8\u130d\u120d \u12e8\u1225\u122b \u121b\u1235\u1270\u120b\u1208\u134a\u12eb \u1243\u1208 \u1218\u1320\u12ed\u1245 \u1290\u12cd\u1362 \u1235\u1208 \u1270\u12f0\u130b\u130b\u121a \u1225\u122b\u12ce\u127d\u1363 \u1218\u1233\u122a\u12eb\u12ce\u127d\u1363 \u12e8\u12cd\u1233\u1294 \u1290\u132d\u1266\u127d\u1363 \u12a0\u133d\u122d \u1218\u1295\u1308\u12f6\u127d \u12a5\u1293 \u1260\u1225\u122b \u121a\u1293 \u12a8\u121b\u1295 \u130b\u122d \u12a5\u1295\u12f0\u121a\u1230\u1229 \u12a5\u1320\u12ed\u1243\u1208\u1201\u1362 \u12e8\u12f0\u1295\u1260\u129b \u12c8\u12ed\u121d \u12e8\u130d\u120d \u1235\u121e\u127d\u1295 \u12a0\u12ed\u1320\u1240\u1219\u1362 \u1260\u1242 \u1218\u1228\u1303 \u1232\u1230\u1321 \u00ab\u1240\u1323\u12ed\u1290\u1275 \u1265\u122a\u134d \u134d\u1320\u122d\u00bb \u12e8\u121a\u1208\u12cd\u1295 \u12ed\u1320\u1240\u1219\u1362",
    create: "\u1240\u1323\u12ed\u1290\u1275 \u1265\u122a\u134d \u134d\u1320\u122d",
    creating: "\u1265\u122a\u134d \u1260\u1218\u134d\u1320\u122d \u120b\u12ed\u2026",
    placeholder: "\u1218\u120d\u1235\u12ce\u1295 \u12ed\u133b\u1349\u2026",
    thinking: "\u1260\u121b\u1230\u1265 \u120b\u12ed\u2026",
    enough:
      "\u1218\u1300\u1218\u122a\u12eb \u1325\u1242\u1275 \u1270\u1328\u1263\u133d \u1218\u120d\u1236\u127d\u1295 \u12eb\u130b\u1229\u1363 \u12a8\u12da\u12eb \u1240\u1323\u12ed\u1290\u1275 \u1265\u122a\u1349\u1295 \u12ed\u134d\u1320\u1229\u1362",
  },
} as const;

function createId() {
  return crypto.randomUUID();
}

export function HandoverChat({
  postingId,
  token,
  postingDescription,
}: {
  postingId: string;
  token: string;
  postingDescription: string | null;
}) {
  const [language, setLanguage] = useState<Language>("en");
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: createId(), role: "assistant", content: COPY.en.starter },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [review, setReview] = useState<{
    generated_brief: string;
    raw_interview_json: RawInterviewJson;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const copy = COPY[language];
  const canGenerate = useMemo(
    () => messages.filter((message) => message.role === "user").length >= 3,
    [messages],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, review]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function switchLanguage(next: Language) {
    if (isStreaming || isGenerating || review) return;
    setLanguage(next);
    setError(null);
    setInput("");
    setMessages([
      { id: createId(), role: "assistant", content: COPY[next].starter },
    ]);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming || isGenerating || review) return;

    setError(null);
    setInput("");

    const nextMessages: UiMessage[] = [
      ...messages,
      { id: createId(), role: "user", content },
    ];
    const assistantId = createId();
    setMessages([
      ...nextMessages,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamConversationFromApi({
        mode: "handover",
        messages: nextMessages.map(({ role, content: text }) => ({
          role,
          content: text,
        })),
        signal: controller.signal,
        endpoint: `/handover/${postingId}/chat`,
        extraBody: { token },
        onText: (assistantText) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: assistantText }
                : message,
            ),
          );
        },
      });
    } catch (streamError) {
      if (
        streamError instanceof DOMException &&
        streamError.name === "AbortError"
      ) {
        return;
      }

      setMessages((current) =>
        current.filter(
          (message) =>
            !(message.id === assistantId && message.content.length === 0),
        ),
      );
      setError(
        streamError instanceof Error
          ? streamError.message
          : "Unable to continue the handover interview",
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function generateBrief() {
    if (!canGenerate || isStreaming || isGenerating || review) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/handover/${postingId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          locale: language,
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        generated_brief?: string;
        raw_interview_json?: RawInterviewJson;
      } | null;

      if (
        !response.ok ||
        !payload?.generated_brief ||
        !payload.raw_interview_json
      ) {
        throw new Error(payload?.error ?? "Failed to create Continuity Brief");
      }

      setReview({
        generated_brief: payload.generated_brief,
        raw_interview_json: payload.raw_interview_json,
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : copy.enough,
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  if (review) {
    return (
      <BriefReview
        postingId={postingId}
        token={token}
        initialBrief={review.generated_brief}
        interview={review.raw_interview_json}
        onBack={() => setReview(null)}
      />
    );
  }

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
      <header className="space-y-3 border-b px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">AI Handover Interview</h1>
            <p className="text-sm text-muted-foreground">
              {postingDescription?.trim() || "Transition role knowledge capture"}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={language === "en" ? "default" : "ghost"}
              onClick={() => switchLanguage("en")}
            >
              English
            </Button>
            <Button
              type="button"
              size="sm"
              variant={language === "am" ? "default" : "ghost"}
              onClick={() => switchLanguage("am")}
            >
              {"\u12a0\u121b\u122d\u129b"}
            </Button>
          </div>
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-busy={isStreaming || isGenerating}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm leading-6"
            }
          >
            {message.content ||
              (isStreaming ? (
                <span className="text-muted-foreground">{copy.thinking}</span>
              ) : null)}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error ? (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-3 border-t p-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!canGenerate || isStreaming || isGenerating}
          onClick={() => void generateBrief()}
        >
          {isGenerating ? copy.creating : copy.create}
        </Button>

        <form className="flex items-end gap-2" onSubmit={submit}>
          <Textarea
            rows={2}
            value={input}
            maxLength={4_000}
            placeholder={copy.placeholder}
            aria-label="Handover interview answer"
            disabled={isStreaming || isGenerating}
            className="max-h-36 min-h-16 resize-none"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) void sendMessage();
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming || isGenerating}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
