import "server-only";

import { Agent } from "undici";

import { telebirrConfig } from "./config";
import {
  createNonceStr,
  createTimeStamp,
  signRequest,
  type SignableRequest,
} from "./sign";

/**
 * HTTP against the Fabric gateway: the token, and signed calls made with it.
 */

export type GatewayResponse<T> = {
  result?: string;
  code?: string;
  msg?: string;
  biz_content?: T;
};

/**
 * The testbed on port 38443 presents a certificate Node will not validate, and
 * Ethio Telecom's own sample answers that with `rejectUnauthorized: false`.
 *
 * The usual shortcut, NODE_TLS_REJECT_UNAUTHORIZED=0, would turn verification
 * off for the entire process -- including every Supabase request carrying the
 * service role key. On a project whose pitch is built on its security model that
 * is not a trade worth making, so the exemption is scoped to this one dispatcher
 * and gated behind an environment flag that is never set in production.
 */
let insecureAgent: Agent | null = null;

function dispatcher() {
  if (!telebirrConfig().allowInsecureTls) return undefined;

  insecureAgent ??= new Agent({ connect: { rejectUnauthorized: false } });
  return insecureAgent;
}

// ---------------------------------------------------------------------------
// Fabric token
// ---------------------------------------------------------------------------

type CachedToken = { token: string; expiresAt: number };

let tokenCache: CachedToken | null = null;

/**
 * Step 1. The token lasts 30 minutes, so it is cached rather than fetched per
 * call, but with a minute of headroom -- an expiry checked against our clock and
 * spent against theirs should not be cut fine.
 *
 * Module-level state, which on Vercel means per-instance. That is the right
 * granularity: a cold instance simply fetches its own.
 */
export async function applyFabricToken(): Promise<string> {
  const config = telebirrConfig();

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const response = await fetch(`${config.baseUrl}/payment/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APP-Key": config.fabricAppId,
    },
    body: JSON.stringify({ appSecret: config.appSecret }),
    dispatcher: dispatcher(),
  } as RequestInit);

  if (!response.ok) {
    throw new Error(
      `Telebirr rejected the token request with HTTP ${response.status}.`,
    );
  }

  const body = (await response.json()) as { token?: string; expires_in?: string };

  if (!body.token) {
    throw new Error("Telebirr returned no fabric token.");
  }

  const ttlSeconds = Number(body.expires_in) || 30 * 60;

  tokenCache = {
    token: body.token,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  };

  return body.token;
}

// ---------------------------------------------------------------------------
// Signed calls
// ---------------------------------------------------------------------------

/**
 * Wraps biz_content in the envelope the gateway expects, signs it, and posts it.
 *
 * `sign_type` is set to the literal "SHA256WithRSA" the protocol asks for even
 * though the signature is PSS -- see sign.ts. The two disagree, and the field is
 * a label rather than an instruction.
 */
export async function postSigned<T>(
  endpoint: string,
  method: string,
  bizContent: Record<string, string>,
): Promise<GatewayResponse<T>> {
  const config = telebirrConfig();
  const token = await applyFabricToken();

  const request: SignableRequest = {
    timestamp: createTimeStamp(),
    nonce_str: createNonceStr(),
    method,
    version: "1.0",
    biz_content: bizContent,
  };

  request.sign = signRequest(request, config.privateKey);
  request.sign_type = "SHA256WithRSA";

  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APP-Key": config.fabricAppId,
      Authorization: token,
    },
    body: JSON.stringify(request),
    dispatcher: dispatcher(),
  } as RequestInit);

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Telebirr ${method} failed with HTTP ${response.status}: ${text}`);
  }

  let parsed: GatewayResponse<T>;
  try {
    parsed = JSON.parse(text) as GatewayResponse<T>;
  } catch {
    throw new Error(`Telebirr ${method} returned a non-JSON body: ${text}`);
  }

  return parsed;
}

/** Clears the cached token. Only used by tests. */
export function resetTokenCache() {
  tokenCache = null;
}
