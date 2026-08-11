import {
  calculateReadinessScore,
  extractSkillMatrix,
  skillExtractionRequestSchema,
} from "@/lib/ai";
import { hasLiveAiKey } from "@/lib/ai/model";
import { stubSkillMatrix } from "@/lib/ai/stub-coach";
import { getSessionProfile } from "@/lib/auth";
import { repo } from "@/lib/data";
import type { SkillsJson } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.role !== "job_seeker") {
    return Response.json(
      { error: "Only job seekers can create a skill matrix" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = skillExtractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Need a longer intake conversation before creating a skill matrix",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const skills = hasLiveAiKey()
      ? await extractSkillMatrix(parsed.data.messages)
      : stubSkillMatrix(parsed.data.messages);
    const readinessScore = calculateReadinessScore(skills);
    const skillsJson = skills as SkillsJson;

    // Through the data seam rather than a direct insert: the offline fallback
    // has no Supabase to reach, and the matcher reads matrices from here.
    const data = await repo().saveSkillMatrix({
      user_id: profile.id,
      skills_json: skillsJson,
      readiness_score: readinessScore,
    });

    return Response.json({
      id: data.id,
      skills_json: data.skills_json,
      readiness_score: data.readiness_score,
      created_at: data.created_at,
      label: "Coach initial read",
      disclaimer:
        "This is the coach's preliminary assessment, not a verified Sandbox Score.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract skill matrix";
    const status =
      message.includes("API key") ||
      message.includes("OPENAI_API_KEY") ||
      message.includes("GEMINI_API_KEY")
        ? 503
        : 500;
    return Response.json({ error: message }, { status });
  }
}
