import {
  recommendCareerPaths,
  recommendationsRequestSchema,
} from "@/lib/ai";
import { hasLiveAiKey } from "@/lib/ai/model";
import { getCatalogNode } from "@/lib/ai/sandbox-catalog";
import { stubRecommendations } from "@/lib/ai/stub-coach";
import { getSessionProfile } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.role !== "job_seeker") {
    return Response.json(
      { error: "Only job seekers can request career recommendations" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recommendationsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid skill matrix", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = hasLiveAiKey()
      ? await recommendCareerPaths(parsed.data.skills_json)
      : stubRecommendations(parsed.data.skills_json);
    const enriched = result.recommendations.map((item) => ({
      path_name: item.path_name,
      reason: item.reason,
      challenges: item.node_ids.map((id) => {
        const node = getCatalogNode(id);
        if (!node) {
          throw new Error(`Unknown Sandbox node: ${id}`);
        }
        return {
          node_id: node.id,
          title: node.title,
          title_am: node.titleAm,
          sector: node.sector,
          href: node.href,
        };
      }),
    }));

    return Response.json({
      recommendations: enriched,
      disclaimer:
        "These paths are based on the coach's initial read. Verified Sandbox Scores come only from graded challenges.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate career recommendations";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
