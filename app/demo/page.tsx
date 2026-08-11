import Link from "next/link";
import { notFound } from "next/navigation";

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
import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { TONE } from "@/lib/tones";

import { actAsAction } from "./actions";

export default async function DemoPersonaPage() {
  // Does not exist with a live database: real accounts come from signup.
  if (repo().kind !== "mock") notFound();

  const [profiles, active] = await Promise.all([
    repo().listProfiles(),
    currentProfile(),
  ]);

  const seekers = profiles.filter((row) => row.role === "job_seeker");
  const smes = profiles.filter((row) => row.role === "sme");

  return (
    <div className="min-h-svh">
      <header className="border-b border-ink-700">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Skill-Connect <span className="text-slate-500">Ethiopia</span>
          </Link>
          <Badge className={TONE.neutral}>Mock data</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <header className="space-y-2">
          <span className="label-caps">Demo control</span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Act as a seed persona
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            The app is running on in-memory fixtures, so there is no database to
            sign in against. Pick a persona to see the candidate or employer side.
            With <span className="font-mono text-xs">supabase</span> as the data
            source this page does not exist and identity comes from real auth.
          </p>
          {active ? (
            <p className="text-xs text-slate-500">
              Currently acting as{" "}
              <span className="text-slate-300">
                {active.full_name ?? active.id}
              </span>
              .
            </p>
          ) : null}
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Job seekers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {seekers.map((profile) => (
              <Card key={profile.id} className="panel">
                <CardHeader>
                  <CardTitle>{profile.full_name ?? profile.id}</CardTitle>
                  <CardDescription>{profile.region}</CardDescription>
                  <CardAction>
                    <Badge
                      className={
                        profile.opt_in_discoverable ? TONE.verified : TONE.neutral
                      }
                    >
                      {profile.opt_in_discoverable ? "Discoverable" : "Opted out"}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.bio ? (
                    <p className="text-xs leading-relaxed text-slate-400">
                      {profile.bio}
                    </p>
                  ) : null}
                  <form action={actAsAction}>
                    <input type="hidden" name="profile_id" value={profile.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Act as {profile.full_name?.split(" ")[0] ?? "this persona"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Companies</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {smes.map((profile) => (
              <Card key={profile.id} className="panel">
                <CardHeader>
                  <CardTitle>{profile.full_name ?? profile.id}</CardTitle>
                  <CardDescription>{profile.region}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={actAsAction}>
                    <input type="hidden" name="profile_id" value={profile.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Act as this company
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
