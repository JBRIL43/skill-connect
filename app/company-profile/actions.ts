"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";

export type CompanyProfileState = { error?: string; saved?: boolean };

const patchSchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(120).optional(),
  size: z.string().trim().max(60).optional(),
  about: z.string().trim().max(1200).optional(),
});

/** Empty inputs mean "not set", which is null in the schema, not "". */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function saveCompanyProfileAction(
  _prev: CompanyProfileState,
  formData: FormData,
): Promise<CompanyProfileState> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "sme") {
    return { error: "Only a company account can edit a company profile." };
  }

  const parsed = patchSchema.safeParse({
    company_name: formData.get("company_name") ?? "",
    industry: formData.get("industry") ?? "",
    size: formData.get("size") ?? "",
    about: formData.get("about") ?? "",
  });

  if (!parsed.success) {
    return { error: "A company name of at least two characters is required." };
  }

  const existing = await repo().getCompanyProfileBySme(profile.id);
  if (!existing) {
    return {
      error:
        "No company profile exists for this account yet. Ask an admin to create one.",
    };
  }

  // verified is absent on purpose: it is the platform's claim about a company,
  // not the company's claim about itself, so only the admin console may set it.
  await repo().updateCompanyProfile(existing.id, {
    company_name: parsed.data.company_name,
    industry: orNull(parsed.data.industry),
    size: orNull(parsed.data.size),
    about: orNull(parsed.data.about),
  });

  revalidatePath("/company-profile");
  revalidatePath(`/company-profile/${existing.id}`);

  return { saved: true };
}
