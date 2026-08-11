"use server";

import { generateText } from "ai";

import { aiModel, isLiveAI } from "@/lib/ai/provider";
import {
  READINESS_QUESTIONS,
  type ReadinessReport,
} from "@/app/readiness/constants";

// Only async functions may be exported from a "use server" file.
// Data and types live in constants.ts.

const READINESS_SYSTEM = `You are an AI readiness advisor for Skill-Connect Ethiopia.
Given five brief answers about an SME's business context, return a JSON object with:
- readiness_level: "emerging" | "developing" | "ready" (one word)
- readiness_score: integer 1–100
- summary: two sentences describing the business's current AI readiness in plain language
- opportunities: array of exactly 3 objects, each with { task: string, impact: string }
  where task is a specific thing an AI-fluent hire could take off their plate this month,
  and impact is one sentence on the business benefit
- next_step: one concrete, actionable sentence the SME can take in the next 48 hours

Reply in the same language the user's answers are primarily written in (English or Amharic).
Return only valid JSON, no markdown fences.`;

type ReadinessAnswers = Record<string, string>;

function stubReport(answers: ReadinessAnswers): ReadinessReport {
  const text = Object.values(answers).join(" ").toLowerCase();

  const hasAi =
    text.includes("chatgpt") ||
    text.includes("ai") ||
    text.includes("gemini") ||
    text.includes("ኤአይ");

  const hasData =
    text.includes("data") ||
    text.includes("record") ||
    text.includes("excel") ||
    text.includes("spreadsheet") ||
    text.includes("inventory");

  const score = 30 + (hasAi ? 25 : 0) + (hasData ? 15 : 0);

  return {
    readiness_level: score >= 60 ? "developing" : "emerging",
    readiness_score: score,
    summary:
      "Your business has the foundations an AI-fluent hire needs to add immediate value. A few targeted tasks are well-suited to AI assistance with minimal setup.",
    opportunities: [
      {
        task: "Automate customer inquiry responses on WhatsApp",
        impact:
          "Cuts response time and frees your team to focus on higher-value work.",
      },
      {
        task: "Build a digital inventory tracker with AI reorder alerts",
        impact:
          "Prevents stockouts and reduces the time spent on manual stock counts.",
      },
      {
        task: "Use AI to draft supplier price comparison summaries",
        impact: "Faster procurement decisions with less manual spreadsheet work.",
      },
    ],
    next_step:
      "Post a Role Skill Template for an AI Operations Assistant on Skill-Connect — candidates with proven AI tool scores will appear within hours.",
  };
}

export async function generateReadinessReport(
  answers: ReadinessAnswers,
): Promise<{ report: ReadinessReport; source: "live" | "stub" }> {
  const prompt = READINESS_QUESTIONS.map(
    (q) => `${q.label}\n${answers[q.id] ?? "(not answered)"}`,
  ).join("\n\n");

  if (isLiveAI()) {
    try {
      const { text } = await generateText({
        model: aiModel(),
        system: READINESS_SYSTEM,
        prompt,
        temperature: 0.3,
      });

      const parsed = JSON.parse(text.trim()) as ReadinessReport;
      if (
        parsed.readiness_level &&
        typeof parsed.readiness_score === "number" &&
        Array.isArray(parsed.opportunities)
      ) {
        return { report: parsed, source: "live" };
      }
    } catch (error) {
      console.error("[readiness] live report failed, using stub", error);
    }
  }

  return { report: stubReport(answers), source: "stub" };
}
