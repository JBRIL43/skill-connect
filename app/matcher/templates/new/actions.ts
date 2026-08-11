"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { draftTemplate, type TemplateDraft } from "@/lib/ai/template-draft";
import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import type { ScoreMap } from "@/lib/data/types";
import { isCompetencyKey } from "@/lib/sandbox/competencies";

export type DraftResult =
  | { ok: true; draft: TemplateDraft }
  | { ok: false; error: string };

/**
 * The plain-language path. Returns a proposal only — nothing is persisted until
 * the SME confirms, because they own the bar they hire against.
 */
export async function draftTemplateAction(problem: string): Promise<DraftResult> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "sme") {
    return { ok: false, error: "Only a company account can draft a template." };
  }

  if (problem.trim().length < 25) {
    return {
      ok: false,
      error:
        "Describe the problem in a sentence or two so the draft has something to work from.",
    };
  }

  try {
    return { ok: true, draft: await draftTemplate(problem.trim()) };
  } catch (error) {
    console.error("[matcher] template draft failed", error);
    return {
      ok: false,
      error: "The draft could not be generated. Set the thresholds manually.",
    };
  }
}

export type CreateTemplateState = { error?: string };

const thresholdSchema = z.record(
  z.string(),
  z.coerce.number().int().min(40).max(95),
);

export async function createTemplateAction(
  _prev: CreateTemplateState,
  formData: FormData,
): Promise<CreateTemplateState> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "sme") {
    return { error: "Only a company account can create a template." };
  }

  const roleName = String(formData.get("role_name") ?? "").trim();
  if (roleName.length < 3) {
    return { error: "Give the role a name of at least three characters." };
  }

  // Only enabled rows are submitted, so absence means "not part of this bar".
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("threshold_")) continue;
    const competency = key.slice("threshold_".length);
    if (isCompetencyKey(competency)) raw[competency] = String(value);
  }

  const parsed = thresholdSchema.safeParse(raw);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return {
      error:
        "Pick at least one competency and a minimum score between 40 and 95.",
    };
  }

  // Written through the frozen vocabulary: a key that is not in it would make
  // every candidate clear zero thresholds, silently.
  const thresholds: ScoreMap = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (isCompetencyKey(key)) thresholds[key] = value;
  }

  await repo().createTemplate({
    sme_id: profile.id,
    role_name: roleName,
    thresholds_json: thresholds,
    notify_on_match: formData.get("notify_on_match") === "on",
  });

  revalidatePath("/matcher");
  redirect("/matcher");
}
