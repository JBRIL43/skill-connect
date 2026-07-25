import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
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

function whenLabel(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function NotificationsPage() {
  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") redirect("/dashboard");

  const notifications = await repo().listNotifications(profile.id);

  const templates = new Map(
    (await repo().listTemplates(profile.id)).map((row) => [row.id, row]),
  );

  const postings = await repo().listPostings(profile.id);
  const postingByTemplate = new Map(
    postings
      .filter((posting) => posting.template_id)
      .map((posting) => [posting.template_id as string, posting]),
  );

  // Opening the list is the acknowledgement, so it marks them seen. Rendered
  // state is captured first so the newly-read rows still show as new this once.
  const unseenIds = notifications.filter((row) => !row.seen).map((row) => row.id);
  await Promise.all(unseenIds.map((id) => repo().markNotificationSeen(id)));
  const unseen = new Set(unseenIds);

  return (
    <div className="min-h-svh">
      <AppHeader profile={profile} />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="space-y-3">
          <Link
            href="/matcher"
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Back to matching
          </Link>

          <div className="space-y-2">
            <span className="label-caps">Alerts</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Candidates who cleared your bar
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Each of these fired the moment a candidate finished a graded
              challenge that put them over every threshold on one of your
              templates.
            </p>
          </div>
        </div>

        {notifications.length === 0 ? (
          <Card className="panel">
            <CardHeader>
              <CardTitle>Nothing yet</CardTitle>
              <CardDescription>
                Templates with alerts enabled are checked against every new
                sandbox score. You will hear about a candidate here first.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const template = templates.get(notification.template_id);
              const posting = template
                ? postingByTemplate.get(template.id)
                : undefined;
              const thresholds = Object.entries(
                template?.thresholds_json ?? {},
              );

              return (
                <Card
                  key={notification.id}
                  className={
                    unseen.has(notification.id)
                      ? "panel border-verdant-500/40"
                      : "panel"
                  }
                >
                  <CardHeader>
                    <CardTitle>
                      {template?.role_name ?? "A role you deleted"}
                    </CardTitle>
                    <CardDescription>
                      A candidate qualified {whenLabel(notification.created_at)}
                    </CardDescription>
                    {unseen.has(notification.id) ? (
                      <CardAction>
                        <Badge className={TONE.verified}>New</Badge>
                      </CardAction>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {thresholds.length ? (
                      <p className="text-xs leading-relaxed text-slate-400">
                        Cleared{" "}
                        {thresholds
                          .map(
                            ([key, minimum]) =>
                              `${competencyLabel(key).toLowerCase()} ${minimum}+`,
                          )
                          .join(", ")}
                        .
                      </p>
                    ) : null}

                    {posting ? (
                      <Link
                        href={`/matcher/postings/${posting.id}`}
                        className="inline-block text-sm text-verdant-400 hover:text-verdant-300"
                      >
                        Run matching to see their score and gap analysis →
                      </Link>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Attach a posting to this template to review candidates.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
