import type { PaymentProvider } from "@/lib/types/database";

/**
 * What the upgrade costs, in whole ETB.
 *
 * Section 6 sells a premium tier on saved Role Skill Templates with
 * auto-notifications plus priority Institutional Handover, but never puts a
 * number on it. This is that number, in one place, because it has to agree
 * across the dashboard copy, the checkout screen and the payments row.
 */
export const PREMIUM_PRICE_ETB = 500;

export const PREMIUM_TITLE = "Skill-Connect Premium";

/**
 * How many Role Skill Templates a free SME may set to notify_on_match.
 *
 * Not zero, deliberately. The demo script fires a notification at step 5 and the
 * upgrade only happens at step 7, so a hard gate would break the demo when run in
 * order. Every seeded SME has exactly one template, so the free tier covers the
 * demo and the upgrade visibly buys the second one.
 */
export const FREE_NOTIFY_TEMPLATE_LIMIT = 1;

export function paymentsProviderName(): PaymentProvider {
  return process.env.PAYMENTS_PROVIDER === "telebirr" ? "telebirr" : "mock";
}

/**
 * Order numbers Telebirr will accept.
 *
 * Their docs disagree with themselves: the field table says `^[A-Za-z0-9]+$`
 * while the prose alongside it allows underscores. Emitting alphanumerics only
 * satisfies both readings. Prefixed so a row is recognisable in their portal, and
 * random-suffixed so two SMEs upgrading in the same millisecond cannot collide.
 */
export function newExternalRef() {
  const random = Math.random().toString(36).slice(2, 10);
  return `SC${Date.now()}${random}`.replace(/[^A-Za-z0-9]/g, "");
}
