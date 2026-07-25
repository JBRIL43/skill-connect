import Link from "next/link";
import { notFound } from "next/navigation";

import { AiForwardBadge } from "@/components/company/ai-forward-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { repo } from "@/lib/data";

/**
 * Public by design — it is listed in the middleware's public prefixes, so a
 * candidate can read it before deciding to be discoverable, without an account.
 */
export default async function PublicCompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await repo().getCompanyProfile(id);
  if (!company) notFound();

  const hires = await repo().countHiredBySme(company.sme_id);

  return (
    <div className="min-h-svh">
      <header className="border-b border-ink-700">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Skill-Connect <span className="text-slate-500">Ethiopia</span>
          </Link>
          <Link
            href="/sandbox"
            className="text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            Prove your skills
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {company.company_name}
            </h1>
            <AiForwardBadge verified={company.verified} />
          </div>

          <p className="text-sm text-slate-400">
            {[company.industry, company.size].filter(Boolean).join(" · ") ||
              "An Ethiopian small business"}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
          <Card className="panel">
            <CardHeader>
              <CardTitle>Where AI already fits here</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">
                {company.about ??
                  "This company has not written up its AI-adoption story yet."}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="panel-muted p-4">
              <p className="label-caps">Hired through Skill-Connect</p>
              <p className="mt-1 font-mono text-3xl text-verdant-400">
                {hires}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {hires === 0
                  ? "No hires yet through the platform."
                  : "Candidates matched on graded ability, not a CV."}
              </p>
            </div>

            {company.verified ? (
              <div className="rounded-lg border border-award-500/30 bg-award-500/5 p-4">
                <p className="text-[11px] leading-relaxed text-award-400/90">
                  Verified as an AI-Forward Business: this company has
                  demonstrated it is genuinely adopting AI, so the role is real
                  rather than aspirational.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
