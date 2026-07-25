import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

type Destination = { href: string; title: string; description: string };

const JOB_SEEKER_LINKS: Destination[] = [
  {
    href: "/coach",
    title: "Talk to your AI career coach",
    description:
      "A conversation in Amharic or English that maps what you can already do.",
  },
  {
    href: "/sandbox",
    title: "Walk-With-AI Sandbox",
    description:
      "Solve real Ethiopian business challenges and earn AI-graded scores and badges.",
  },
];

const SME_LINKS: Destination[] = [
  {
    href: "/readiness",
    title: "Free AI Readiness Snapshot",
    description:
      "Two minutes to see which tasks an AI-fluent hire could take off your plate.",
  },
  {
    href: "/matcher",
    title: "Role Skill Templates and matching",
    description:
      "Set the bar once, then get notified whenever a candidate clears it.",
  },
  {
    href: "/company-profile",
    title: "Your company profile",
    description:
      "Your public page and AI-adoption journey, plus your verification status.",
  },
  {
    href: "/dashboard/upgrade",
    title: "Upgrade to Premium",
    description:
      "Auto-notify on every role you hire for, and priority Institutional Handover.",
  },
];

export default async function DashboardPage() {
  const profile = await requireProfile();

  // Admins have their own console; role routing sends them there.
  if (profile.role === "admin") redirect("/admin");

  const links = profile.role === "sme" ? SME_LINKS : JOB_SEEKER_LINKS;

  return (
    <AppShell profile={profile}>
      <PageHeader
        title={
          profile.full_name
            ? `Welcome, ${profile.full_name.split(" ")[0]}`
            : "Welcome"
        }
        description={
          profile.role === "sme"
            ? "Find talent whose ability has been graded, not self-reported."
            : "Build skills an AI economy still needs, and prove them with a score."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="group">
            <Card className="h-full transition-shadow group-hover:ring-foreground/25">
              <CardHeader>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
