import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { NotificationBell } from "@/components/matcher/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { competencyLabel } from "@/lib/sandbox/competencies";
import { TONE } from "@/lib/tones";

export default async function MatcherPage() {
  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  const [templates, postings, notifications] = await Promise.all([
    repo().listTemplates(profile.id),
    repo().listPostings(profile.id),
    repo().listNotifications(profile.id),
  ]);

  const postingByTemplate = new Map(
    postings
      .filter((posting) => posting.template_id)
      .map((posting) => [posting.template_id as string, posting]),
  );

  const unseen = notifications.filter((row) => !row.seen).length;

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="label-caps">Pillar 3</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Role templates and matching
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Set the bar once. Candidates appear when their graded scores clear
              it, and you hear about them the moment they qualify.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell unseen={unseen} />
            <Button render={<Link href="/matcher/templates/new" />}>
              New template
            </Button>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Your Role Skill Templates
          </h2>

          {templates.length === 0 ? (
            <Card className="panel">
              <CardHeader>
                <CardTitle>No templates yet</CardTitle>
                <CardDescription>
                  Describe a hiring problem in plain words and the builder will
                  propose the thresholds for you.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => {
                const posting = postingByTemplate.get(template.id);
                const thresholds = Object.entries(template.thresholds_json);

                return (
                  <Card key={template.id} className="panel">
                    <CardHeader>
                      <CardTitle>{template.role_name}</CardTitle>
                      <CardDescription>
                        {thresholds.length} threshold
                        {thresholds.length === 1 ? "" : "s"}
                      </CardDescription>
                      {template.notify_on_match ? (
                        <CardAction>
                          <Badge className={TONE.verified}>Alerts on</Badge>
                        </CardAction>
                      ) : null}
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        {thresholds.map(([key, minimum]) => (
                          <div
                            key={key}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-300">
                              {competencyLabel(key)}
                            </span>
                            <span className="font-mono text-slate-500">
                              min {minimum}
                            </span>
                          </div>
                        ))}
                      </div>

                      {posting ? (
                        <Link
                          href={`/matcher/postings/${posting.id}`}
                          className="inline-block text-sm text-verdant-400 hover:text-verdant-300"
                        >
                          View matched candidates →
                        </Link>
                      ) : (
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          No posting is attached to this template yet, so there is
                          nothing to match against.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
