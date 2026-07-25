"use client";

import { useMemo, useRef, useState } from "react";

import { SkillMatrixResult } from "@/app/coach/_components/skill-matrix-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { streamConversationFromApi } from "@/lib/ai/client";
import type { ConversationMessage, SkillMatrixOutput } from "@/lib/ai";

type Language = "en" | "am";

type SkillResult = {
  id: string;
  skills_json: SkillMatrixOutput;
  readiness_score: number;
};

const COPY: Record<
  Language,
  {
    badge: string;
    title: string;
    description: string;
    starter: string;
    placeholder: string;
    send: string;
    extract: string;
    extracting: string;
    reset: string;
    emptyHint: string;
  }
> = {
  en: {
    badge: "English",
    title: "AI Talent Discovery Coach",
    description:
      "Have a natural conversation about your background, skills, and goals. When you have shared enough signal, create your initial skill map.",
    starter:
      "Hi — I'm your Skill-Connect coach. Tell me a little about your background and the kind of work you want to grow into.",
    placeholder: "Type in English or Amharic…",
    send: "Send",
    extract: "Create my skill map",
    extracting: "Creating skill map…",
    reset: "Start over",
    emptyHint:
      "Reply in your own words. One thoughtful answer at a time is enough.",
  },
  am: {
    badge: "አማርኛ",
    title: "የAI ተሰጥኦ ማግኛ አሰልጣኝ",
    description:
      "ስለ ዳራዎ፣ ክህሎትዎ እና ግቦችዎ በተፈጥሮ ውይይት ይነጋገሩ። በቂ መረጃ ሲሰጡ የመጀመሪያ ክህሎት ካርታዎን ይፍጠሩ።",
    starter:
      "ሰላም — የSkill-Connect አሰልጣኝዎ ነኝ። ስለ ዳራዎ እና ሊያድጉበት ስለሚፈልጉት ሥራ በአጭሩ ይንገሩኝ።",
    placeholder: "በአማርኛ ወይም በእንግሊዝኛ ይጻፁ…",
    send: "ላክ",
    extract: "ክህሎት ካርታዬን ፍጠር",
    extracting: "ክህሎት ካርታ በመፍጠር ላይ…",
    reset: "እንደገና ጀምር",
    emptyHint: "በራስዎ ቃላት ይመልሱ። በአንድ ጊዜ አንድ ጥልቅ መልስ በቂ ነው።",
  },
};

function createId() {
  return crypto.randomUUID();
}

type UiMessage = ConversationMessage & { id: string };

export function CoachChat() {
  const [language, setLanguage] = useState<Language>("en");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>(() => [
    {
      id: createId(),
      role: "assistant",
      content: COPY.en.starter,
    },
  ]);
  const abortRef = useRef<AbortController | null>(null);

  const copy = COPY[language];
  const canExtract = useMemo(
    () => messages.filter((message) => message.role === "user").length >= 3,
    [messages],
  );

  function switchLanguage(next: Language) {
    if (isStreaming || isExtracting) return;
    setLanguage(next);
    setError(null);
    setResult(null);
    setInput("");
    setMessages([
      {
        id: createId(),
        role: "assistant",
        content: COPY[next].starter,
      },
    ]);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming || isExtracting || result) return;

    setError(null);
    setInput("");

    const nextMessages: UiMessage[] = [
      ...messages,
      { id: createId(), role: "user", content },
    ];
    setMessages(nextMessages);

    const assistantId = createId();
    setMessages((current) => [
      ...current,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamConversationFromApi({
        mode: "coach",
        messages: nextMessages.map(({ role, content: text }) => ({
          role,
          content: text,
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

      const message =
        streamError instanceof Error
          ? streamError.message
          : "Unable to reach the coach";
      setError(message);
      setMessages((current) =>
        current.filter(
          (entry) => !(entry.id === assistantId && entry.content === ""),
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function extractSkills() {
    if (!canExtract || isStreaming || isExtracting || result) return;

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (SkillResult & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("skills_json" in payload)) {
        throw new Error(payload?.error ?? "Skill extraction failed");
      }

      setResult({
        id: payload.id,
        skills_json: payload.skills_json,
        readiness_score: payload.readiness_score,
      });
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? extractError.message
          : "Unable to create skill map";
      setError(message);
    } finally {
      setIsExtracting(false);
    }
  }

  function resetConversation() {
    abortRef.current?.abort();
    setError(null);
    setResult(null);
    setInput("");
    setIsStreaming(false);
    setIsExtracting(false);
    setMessages([
      {
        id: createId(),
        role: "assistant",
        content: COPY[language].starter,
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{copy.title}</CardTitle>
                <Badge variant="outline">{copy.badge}</Badge>
              </div>
              <CardDescription>{copy.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={language === "en" ? "default" : "outline"}
                onClick={() => switchLanguage("en")}
                disabled={isStreaming || isExtracting}
              >
                English
              </Button>
              <Button
                type="button"
                size="sm"
                variant={language === "am" ? "default" : "outline"}
                onClick={() => switchLanguage("am")}
                disabled={isStreaming || isExtracting}
              >
                አማርኛ
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-xl border bg-muted/20 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[85%] rounded-2xl border bg-background px-3 py-2 text-sm leading-6"
                }
              >
                {message.content ||
                  (isStreaming ? (
                    <span className="text-muted-foreground">…</span>
                  ) : null)}
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">{copy.emptyHint}</p>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.placeholder}
              disabled={Boolean(result) || isStreaming || isExtracting}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void sendMessage()}
                disabled={
                  !input.trim() ||
                  Boolean(result) ||
                  isStreaming ||
                  isExtracting
                }
              >
                {copy.send}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void extractSkills()}
                disabled={
                  !canExtract || Boolean(result) || isStreaming || isExtracting
                }
              >
                {isExtracting ? copy.extracting : copy.extract}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetConversation}
                disabled={isStreaming || isExtracting}
              >
                {copy.reset}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <SkillMatrixResult
          matrix={result.skills_json}
          readinessScore={result.readiness_score}
        />
      ) : null}
    </div>
  );
}
