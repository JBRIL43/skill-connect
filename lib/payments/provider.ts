import "server-only";

import type { PaymentProvider } from "@/lib/types/database";
import { paymentsProviderName } from "./config";
import { mockProvider } from "./mock";
import type { PaymentProviderAdapter } from "./types";

/**
 * Picks the rail. The only place in the codebase that is allowed to know which
 * one is live.
 *
 * The Telebirr adapter is imported lazily on purpose. It reads five credentials
 * at module scope and throws if any are missing, which is the behaviour we want
 * when it is the configured provider -- and exactly the behaviour we do not want
 * when a teammate is running the mock with an empty .env.local.
 */
export async function getPaymentProviderByName(
  name: PaymentProvider,
): Promise<PaymentProviderAdapter> {
  if (name === "telebirr") {
    const { telebirrProvider } = await import("./telebirr");
    return telebirrProvider;
  }

  // 'chapa' lands here too. Section 6 carries it as a multi-rail talking point
  // for the pitch, not as something we implement in 48 hours.
  return mockProvider;
}

/** The provider a new checkout should use, from PAYMENTS_PROVIDER. */
export async function getPaymentProvider(): Promise<PaymentProviderAdapter> {
  return getPaymentProviderByName(paymentsProviderName());
}
