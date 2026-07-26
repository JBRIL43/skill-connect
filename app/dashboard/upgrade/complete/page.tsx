import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/lib/types/database";
import { findPaymentByRef } from "@/lib/payments/orders";
import { PendingPoller } from "./pending-poller";

export const metadata = { title: "Payment" };

/**
 * Where checkout lands, for both rails. This is also TELEBIRR_RETURN_URL, so it
 * has to make sense to someone arriving straight from telebirr's own site with
 * no idea whether their payment registered.
 */
export default async function UpgradeCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const profile = await requireRole("sme");
  const { ref } = await searchParams;

  const payment = ref ? await findPaymentByRef(ref) : await latestPayment(profile.id);
  const owned = payment && payment.sme_id === profile.id;
  const paid = owned && payment.status === "paid";

  return (
    <AppShell profile={profile}>
      <PageHeader
        title={paid ? "You are on Premium" : "Payment not confirmed yet"}
        description={
          paid
            ? "Auto-notify is unlocked on every Role Skill Template, and your handovers are prioritised."
            : "We have not had confirmation from the payment provider for this order."
        }
        action={
          paid ? <Badge>Active</Badge> : <Badge variant="outline">Pending</Badge>
        }
      />

      {!owned ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No such order</CardTitle>
            <CardDescription>
              We could not find a payment on this account to show you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/dashboard/upgrade" />}>
              Back to Upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {payment.amount.toLocaleString()} ETB &middot;{" "}
              {payment.provider === "telebirr" ? "telebirr" : "demo checkout"}
            </CardTitle>
            <CardDescription>
              Order {payment.external_ref}
              {payment.provider_tx_id
                ? ` · telebirr reference ${payment.provider_tx_id}`
                : null}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {paid ? (
              <div className="flex flex-wrap gap-2">
                <Button render={<Link href="/matcher" />}>
                  Set up another template
                </Button>
                <Button variant="outline" render={<Link href="/dashboard" />}>
                  Back to dashboard
                </Button>
              </div>
            ) : (
              <PendingPoller externalRef={payment.external_ref ?? ""} />
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

/**
 * Telebirr's redirect_url is fixed at preOrder time, so we append the reference
 * ourselves. If something strips it, showing this SME's most recent order beats
 * showing them nothing.
 */
async function latestPayment(smeId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("payments")
    .select("*")
    .eq("sme_id", smeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Payment>();

  return data ?? null;
}
