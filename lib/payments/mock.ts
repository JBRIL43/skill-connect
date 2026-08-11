import type {
  CheckoutRequest,
  CheckoutSession,
  ConfirmResult,
  PaymentProviderAdapter,
} from "./types";

/**
 * The fallback Section 16 asks us to have ready regardless: a Telebirr-styled
 * checkout that never leaves our origin.
 *
 * It is not a stub that gets deleted once the real rail works. Venue WiFi, an
 * expired testbed credential or a gateway outage during judging all end with
 * flipping PAYMENTS_PROVIDER back to `mock` and redeploying, so this path stays
 * maintained and stays tested.
 *
 * The redirect goes to our own checkout screen, which is where the SME presses
 * confirm. Because there is no external gateway, `confirm` approves whatever it
 * is handed -- pressing the button IS the payment.
 */
export const mockProvider: PaymentProviderAdapter = {
  name: "mock",
  settlesOutOfBand: false,

  async createCheckout({ externalRef }: CheckoutRequest): Promise<CheckoutSession> {
    return { redirectUrl: `/dashboard/upgrade/checkout?ref=${externalRef}` };
  },

  async confirm(externalRef: string): Promise<ConfirmResult> {
    return { paid: true, providerTxId: `MOCK${externalRef}` };
  },
};
