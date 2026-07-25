import {
  calculateReadinessScore,
  extractSkillMatrix,
  skillExtractionRequestSchema,
} from "@/lib/ai";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
    const skills = await extractSkillMatrix(parsed.data.messages);
    const readinessScore = calculateReadinessScore(skills);
    const skillsJson = skills as SkillsJson;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("skill_matrices")
      .insert({
        user_id: profile.id,
        skills_json: skillsJson,
        readiness_score: readinessScore,
      })
      .select("id, skills_json, readiness_score, created_at")
      .single();

    if (error) {
      return Response.json(
        { error: "Failed to save skill matrix", details: error.message },
        { status: 500 },
      );
    }

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
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
