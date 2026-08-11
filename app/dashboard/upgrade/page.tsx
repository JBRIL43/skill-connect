import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TelebirrMark } from "@/components/telebirr-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  FREE_NOTIFY_TEMPLATE_LIMIT,
  PREMIUM_PRICE_ETB,
  paymentsProviderName,
} from "@/lib/payments/config";
import { isPremium } from "@/lib/payments/premium";
import { UpgradeButton } from "./upgrade-button";

export const metadata = { title: "Upgrade" };

const INCLUDED = [
  {
    title: "Unlimited auto-notify templates",
    description: `Free accounts can watch ${FREE_NOTIFY_TEMPLATE_LIMIT} Role Skill Template. Premium watches every role you hire for, and tells you the moment a candidate clears the bar.`,
  },
  {
    title: "Priority Institutional Handover",
    description:
      "Your continuity briefs and the custom sandbox challenges built from them go to the front of the queue.",
  },
  {
    title: "Verified company badge",
    description:
      "Candidates see that your company profile has been checked, which matters when they are choosing who to answer.",
  },
];

export default async function UpgradePage() {
  const profile = await requireRole("sme");
  const premium = await isPremium(profile.id);
  const live = paymentsProviderName() === "telebirr";

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Upgrade to Premium"
        description="Hiring on graded ability rather than a CV, across every role you fill."
        action={
          premium ? <Badge>Active</Badge> : <Badge variant="outline">Free plan</Badge>
        }
      />

      {premium ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">You are on Premium</CardTitle>
            <CardDescription>
              Auto-notify is unlocked on every template, and your handovers are
              prioritised. Nothing else to do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/matcher" />}>
              Go to your templates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardDescription>Premium, billed monthly</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {PREMIUM_PRICE_ETB.toLocaleString()} ETB
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <UpgradeButton label="Pay with telebirr" />

              <div className="flex items-center gap-2 border-t pt-4">
                <TelebirrMark />
                <p className="text-xs text-muted-foreground">
                  {live
                    ? "Live sandbox checkout on Ethio Telecom's testbed."
                    : "Demo checkout. No money moves and no telebirr account is charged."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
