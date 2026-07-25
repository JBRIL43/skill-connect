import "server-only";

/**
 * The five credentials plus the endpoints, read once and validated loudly.
 *
 * Read lazily rather than at module scope: provider.ts imports this file
 * dynamically precisely so that a teammate running the mock with an empty
 * .env.local never trips over it.
 */

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. Telebirr needs all five credentials from ` +
        "developer.ethiotelecom.et; see .env.example. To run without them, " +
        "set PAYMENTS_PROVIDER=mock.",
    );
  }

  return value;
}

export type TelebirrConfig = {
  baseUrl: string;
  webCheckoutUrl: string;
  fabricAppId: string;
  appSecret: string;
  merchantAppId: string;
  merchantCode: string;
  privateKey: string;
  notifyUrl: string;
  returnUrl: string;
  allowInsecureTls: boolean;
};

let cached: TelebirrConfig | null = null;

export function telebirrConfig(): TelebirrConfig {
  if (cached) return cached;

  cached = {
    // Trailing slashes would produce a double slash on every endpoint.
    baseUrl: required("TELEBIRR_BASE_URL").replace(/\/+$/, ""),
    // This one legitimately ends in "?" -- it is a query-string prefix.
    webCheckoutUrl: required("TELEBIRR_WEB_CHECKOUT_URL"),
    fabricAppId: required("TELEBIRR_FABRIC_APP_ID"),
    appSecret: required("TELEBIRR_APP_SECRET"),
    merchantAppId: required("TELEBIRR_MERCHANT_APP_ID"),
    merchantCode: required("TELEBIRR_MERCHANT_CODE"),
    privateKey: required("TELEBIRR_PRIVATE_KEY"),
    notifyUrl: required("TELEBIRR_NOTIFY_URL"),
    returnUrl: required("TELEBIRR_RETURN_URL"),
    allowInsecureTls: process.env.TELEBIRR_ALLOW_INSECURE_TLS === "true",
  };

  return cached;
}
