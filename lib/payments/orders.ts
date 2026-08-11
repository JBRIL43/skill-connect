import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/lib/types/database";
import { PREMIUM_PRICE_ETB, PREMIUM_TITLE, newExternalRef } from "./config";
import { getPaymentProvider, getPaymentProviderByName } from "./provider";

/**
 * Opening and settling an upgrade.
 *
 * Everything here runs as the service role, because a client that could write
 * its own payments row could give itself premium for free. RLS already blocks
 * that -- payments has select policies only -- and migration 0007 revokes the
 * grants underneath as well.
 */

export type StartedCheckout = { redirectUrl: string; externalRef: string };

export async function startUpgrade(smeId: string): Promise<StartedCheckout> {
  const provider = await getPaymentProvider();
  const admin = createAdminClient();
  const externalRef = newExternalRef();

  // The row goes in before the provider is told anything. Telebirr's webhook is
  // fired by their servers and has beaten slower redirects in the wild; if it
  // arrives before we have a row to match it against, the payment is lost.
  const { error } = await admin.from("payments").insert({
    sme_id: smeId,
    provider: provider.name,
    amount: PREMIUM_PRICE_ETB,
    status: "pending",
    external_ref: externalRef,
  });

  if (error) {
    throw new Error(`Could not open a payment: ${error.message}`);
  }

  const session = await provider.createCheckout({
    smeId,
    amount: PREMIUM_PRICE_ETB,
    title: PREMIUM_TITLE,
    externalRef,
  });

  return { redirectUrl: session.redirectUrl, externalRef };
}

export type ReconcileResult = {
  found: boolean;
  paid: boolean;
  /** True when the row was already settled, so this call changed nothing. */
  alreadyPaid: boolean;
  detail?: string;
};

/**
 * Ask the provider where an order stands and settle the row if it has been paid.
 *
 * Safe to call as often as you like, from as many places as you like -- which
 * matters, because three different things call it: the webhook, the completion
 * screen polling behind it, and the mock's confirm button. Telebirr will also
 * happily deliver the same notification twice.
 */
export async function reconcilePayment(
  externalRef: string,
): Promise<ReconcileResult> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("payments")
    .select("id, status, provider")
    .eq("external_ref", externalRef)
    .maybeSingle<Pick<Payment, "id" | "status" | "provider">>();

  if (!row) return { found: false, paid: false, alreadyPaid: false };
  if (row.status === "paid") return { found: true, paid: true, alreadyPaid: true };

  // Asked by the provider that opened the order, not by whatever
  // PAYMENTS_PROVIDER happens to say now. Falling back to the mock mid-demo must
  // not leave real Telebirr orders being confirmed by the mock, which approves
  // everything.
  const provider = await getPaymentProviderByName(row.provider);
  const result = await provider.confirm(externalRef);

  if (!result.paid) {
    return { found: true, paid: false, alreadyPaid: false, detail: result.detail };
  }

  // The status filter is the idempotency guard: a second webhook for an order
  // already settled updates zero rows rather than overwriting provider_tx_id.
  const { error } = await admin
    .from("payments")
    .update({ status: "paid", provider_tx_id: result.providerTxId ?? null })
    .eq("external_ref", externalRef)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Could not settle ${externalRef}: ${error.message}`);
  }

  return { found: true, paid: true, alreadyPaid: false };
}

/** The row behind a checkout screen. Service role, so callers must check ownership. */
export async function findPaymentByRef(externalRef: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("payments")
    .select("*")
    .eq("external_ref", externalRef)
    .maybeSingle<Payment>();

  return data ?? null;
}
