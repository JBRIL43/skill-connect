"use client";

import { RotateCcw, Send, Sparkles, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamConversationFromApi } from "@/lib/ai/client";
import type { ConversationMessage } from "@/lib/ai/schemas";

type UiMessage = ConversationMessage & { id: string };

const STARTER =
  "Hi! Ask me how Skill-Connect coaching, Sandbox Scores, matching, or transition handovers work. You can write in English or Amharic.";

const SUGGESTIONS = [
  "How does matching work?",
  "What is a Sandbox Score?",
  "የሥራ ማዛመድ እንዴት ይሰራል?",
] as const;

function createStarter(): UiMessage[] {
  return [{ id: crypto.randomUUID(), role: "assistant", content: STARTER }];
}

export function AskSkillConnect({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<UiMessage[]>(createStarter);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const hasUserMessage = messages.some((message) => message.role === "user");

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    setError(null);

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    const nextMessages = [...messages, userMessage];

    setMessages([
      ...nextMessages,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamConversationFromApi({
        mode: "chatbot",
        messages: nextMessages
          .slice(-24)
          .map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
        signal: controller.signal,
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
          : "Ask Skill-Connect is unavailable right now.",
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function reset() {
    abortRef.current?.abort();
    setMessages(createStarter());
    setInput("");
    setError(null);
    setIsStreaming(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    abortRef.current?.abort();
    onClose();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              Ask Skill-Connect
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              Product help · English / አማርኛ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Reset conversation"
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Close Ask Skill-Connect"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-busy={isStreaming}
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
                <span className="text-muted-foreground">Thinking…</span>
              ) : null)}
          </div>
        ))}

        {!hasUserMessage ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void sendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
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

      <form className="flex items-end gap-2 border-t p-3" onSubmit={submit}>
        <Textarea
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={4_000}
          placeholder="Ask about Skill-Connect…"
          aria-label="Message Ask Skill-Connect"
          disabled={isStreaming}
          className="max-h-28 min-h-9 resize-none"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (input.trim()) void sendMessage(input);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!input.trim() || isStreaming}
        >
          <Send aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
