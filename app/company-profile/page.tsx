import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AiForwardBadge } from "@/components/company/ai-forward-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";

import { CompanyProfileForm } from "./company-profile-form";

export default async function OwnCompanyProfilePage() {
  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  const company = await repo().getCompanyProfileBySme(profile.id);
  const hires = company ? await repo().countHiredBySme(profile.id) : 0;

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <header className="space-y-2">
          <span className="label-caps">Pillar 3</span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your company profile
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Hiring runs both ways here. Candidates see this page before they
            agree to be matched, so the AI-adoption story is part of the offer.
          </p>
        </header>

        {company ? (
          <>
            <Card className="panel">
              <CardHeader>
                <CardTitle>Verification and track record</CardTitle>
                <CardDescription>
                  Neither field is editable here — both are earned.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-6">
                <div className="space-y-1">
                  <p className="label-caps">Status</p>
                  {company.verified ? (
                    <AiForwardBadge verified />
                  ) : (
                    <p className="text-sm text-slate-400">
                      Not yet verified. An admin reviews this.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="label-caps">Hires through Skill-Connect</p>
                  <p className="font-mono text-2xl text-verdant-400">{hires}</p>
                </div>

                <div className="space-y-1">
                  <p className="label-caps">Public page</p>
                  <Link
                    href={`/company-profile/${company.id}`}
                    className="text-sm text-verdant-400 hover:text-verdant-300"
                  >
                    View as a candidate sees it →
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="panel">
              <CardHeader>
                <CardTitle>Edit your profile</CardTitle>
              </CardHeader>
              <CardContent>
                <CompanyProfileForm profile={company} />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="panel">
            <CardHeader>
              <CardTitle>No company profile yet</CardTitle>
              <CardDescription>
                A company profile is created alongside your account. Ask an admin
                to add one for {profile.full_name ?? "this account"} and this page
                becomes editable.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  );
}
