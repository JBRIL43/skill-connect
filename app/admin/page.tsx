import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScoresJson, SkillsJson } from "@/lib/types/database";

import { setCompanyVerifiedAction } from "./actions";
import { SeedButton } from "./seed-button";

export const dynamic = "force-dynamic";

type CandidateRow = {
  id: string;
  full_name: string | null;
  region: string | null;
  opt_in_discoverable: boolean;
  is_seed: boolean;
  skill_matrices: { readiness_score: number | null; skills_json: SkillsJson }[];
  sandbox_scores: { node_id: string; scores_json: ScoresJson; completed_at: string }[];
};

type CompanyRow = {
  id: string;
  sme_id: string;
  company_name: string;
  industry: string | null;
  verified: boolean;
};

async function loadCounters() {
  const admin = createAdminClient();
  const head = { count: "exact" as const, head: true };

  const [jobSeekers, smes, postings, matches, transitionRoles] =
    await Promise.all([
      admin.from("profiles").select("*", head).eq("role", "job_seeker"),
      admin.from("profiles").select("*", head).eq("role", "sme"),
      admin.from("sme_postings").select("*", head),
      admin.from("matches").select("*", head),
      admin
        .from("sme_postings")
        .select("*", head)
        .eq("is_transition_role", true),
    ]);

  return {
    jobSeekers: jobSeekers.count ?? 0,
    smes: smes.count ?? 0,
    postings: postings.count ?? 0,
    matches: matches.count ?? 0,
    transitionRoles: transitionRoles.count ?? 0,
  };
}

/**
 * The one place raw skill matrices and Sandbox Scores are readable side by
 * side. Service role, server component only — this data never crosses to an SME
 * (Section 9), so it must not become a client-fetched endpoint.
 */
async function loadCandidates(query: string) {
  const admin = createAdminClient();

  let request = admin
    .from("profiles")
    .select(
      "id, full_name, region, opt_in_discoverable, is_seed, skill_matrices(readiness_score, skills_json), sandbox_scores(node_id, scores_json, completed_at)",
    )
    .eq("role", "job_seeker")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query) {
    request = request.or(`full_name.ilike.%${query}%,region.ilike.%${query}%`);
  }

  const { data } = await request;
  return (data ?? []) as CandidateRow[];
}

async function loadCompanies() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("company_profiles")
    .select("id, sme_id, company_name, industry, verified")
    .order("verified", { ascending: true })
    .order("company_name");

  return (data ?? []) as CompanyRow[];
}

/** Newest score per competency, the same rule the notification check applies. */
function latestScores(rows: CandidateRow["sandbox_scores"]) {
  const sorted = [...rows].sort((a, b) =>
    b.completed_at.localeCompare(a.completed_at),
  );

  const latest: ScoresJson = {};
  for (const row of sorted) {
    for (const [competency, score] of Object.entries(row.scores_json ?? {})) {
      if (typeof score === "number" && !(competency in latest)) {
        latest[competency] = score;
      }
    }
  }
  return latest;
}

function humanize(competency: string) {
  return competency.replace(/_/g, " ");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireRole("admin");
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [counters, candidates, companies] = await Promise.all([
    loadCounters(),
    loadCandidates(query),
    loadCompanies(),
  ]);

  const cards = [
    { label: "Job seekers", value: counters.jobSeekers },
    { label: "Companies", value: counters.smes },
    { label: "Postings", value: counters.postings },
    { label: "Matches made", value: counters.matches },
    { label: "Transition roles", value: counters.transitionRoles },
  ];

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Admin console"
        description="Platform-wide view. Counters read live from the database."
        action={<SeedButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="gap-1">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {card.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Candidates</h2>
            <p className="text-sm text-muted-foreground">
              Skill matrices and Sandbox Scores. Admin-only — companies never see
              this view.
            </p>
          </div>

          <form className="flex gap-2">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search name or region"
              className="w-56"
              aria-label="Search candidates"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>

        {candidates.length === 0 ? (
          <EmptyState
            title={query ? `No candidate matches "${query}"` : "No candidates yet"}
            description={
              query
                ? "Try a different name or region."
                : "Press Seed demo data to load the demo personas."
            }
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Readiness</TableHead>
                    <TableHead>Latest Sandbox Scores</TableHead>
                    <TableHead>Discoverable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => {
                    const scores = latestScores(candidate.sandbox_scores);
                    const readiness = candidate.skill_matrices[0]?.readiness_score;

                    return (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          {candidate.full_name ?? "Unnamed"}
                          {candidate.is_seed ? (
                            <Badge variant="outline" className="ml-2">
                              seed
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {candidate.region ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof readiness === "number" ? (
                            <ScoreBadge score={readiness} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {Object.keys(scores).length === 0 ? (
                            <span className="text-muted-foreground">
                              No graded challenges
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(scores).map(([competency, score]) => (
                                <ScoreBadge
                                  key={competency}
                                  score={score}
                                  label={humanize(competency)}
                                />
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.opt_in_discoverable ? (
                            <Badge variant="secondary">Opted in</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Private
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Company verification
          </h2>
          <p className="text-sm text-muted-foreground">
            Unverified is the pending state every company starts in (Section 4).
          </p>
        </div>

        {companies.length === 0 ? (
          <EmptyState
            title="No companies yet"
            description="Press Seed demo data to load the demo personas."
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.company_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {company.industry ?? "—"}
                      </TableCell>
                      <TableCell>
                        {company.verified ? (
                          <Badge>Verified</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={setCompanyVerifiedAction}>
                          <input
                            type="hidden"
                            name="sme_id"
                            value={company.sme_id}
                          />
                          <input
                            type="hidden"
                            name="verified"
                            value={String(!company.verified)}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={company.verified ? "ghost" : "outline"}
                          >
                            {company.verified ? "Revoke" : "Verify"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
