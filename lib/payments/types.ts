import type { PaymentProvider } from "@/lib/types/database";

/**
 * The seam between the app and whoever is actually taking the money.
 *
 * Section 16 lists "Telebirr sandbox credentials don't arrive in time" as a live
 * risk, and the answer to it is that swapping the real rail for the styled mock
 * is an environment variable rather than a code change. That only holds if
 * nothing outside lib/payments/ ever asks which provider is in play -- so the
 * two calls below are deliberately the whole surface.
 */

export type CheckoutRequest = {
  smeId: string;
  /** Whole ETB. payments.amount is an integer and Telebirr wants no fractions here. */
  amount: number;
  /** Shown on the provider's own checkout screen. */
  title: string;
  /** Our order number. Round-trips through the provider and comes back on the webhook. */
  externalRef: string;
};

export type CheckoutSession = {
  /** Where to send the browser next. May be on our origin (mock) or the provider's. */
  redirectUrl: string;
};

export type ConfirmResult = {
  paid: boolean;
  /** The provider's own transaction id, once there is one. */
  providerTxId?: string;
  /** Provider-side status when it is not paid, for logging a stuck order. */
  detail?: string;
};

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;

  /**
   * True when the provider settles somewhere we cannot see -- the user leaves our
   * origin, pays, and we find out via webhook or by asking. Drives whether the
   * completion screen has to poll, and stops it from treating "not paid yet" as
   * failure. False for the mock, which settles the moment the button is pressed.
   */
  readonly settlesOutOfBand: boolean;

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;

  /** Ask the provider where an order stands. Must be safe to call repeatedly. */
  confirm(externalRef: string): Promise<ConfirmResult>;
}
