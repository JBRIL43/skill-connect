import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

export default async function AdminPage() {
  const profile = await requireRole("admin");
  const counters = await loadCounters();

  const cards = [
    { label: "Job seekers", value: counters.jobSeekers },
    { label: "Companies", value: counters.smes },
    { label: "Postings", value: counters.postings },
    { label: "Matches made", value: counters.matches },
    { label: "Transition roles", value: counters.transitionRoles },
  ];

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin console
          </h1>
          <p className="text-muted-foreground">
            Platform-wide view. Counters read live from the database.
          </p>
        </div>

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
      </main>
    </div>
  );
}
