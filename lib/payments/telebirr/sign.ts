import crypto from "node:crypto";

/**
 * Request signing for Telebirr's Fabric gateway.
 *
 * Kept free of `server-only` and of any environment reading so it can be
 * exercised directly by scripts/test-telebirr-sign.ts. That test matters more
 * than it looks: a bad signature comes back as "verify sign failed" and nothing
 * else, with no indication of which of the several ways to get this wrong you
 * chose.
 */

/**
 * Fields the gateway leaves out of the signature. Taken verbatim from Ethio
 * Telecom's sample so the list stays comparable to theirs.
 *
 * `biz_content` is here because the object itself is not signed -- its contents
 * are hoisted into the same flat list as the envelope and signed alongside it.
 */
const EXCLUDED = new Set([
  "sign",
  "sign_type",
  "header",
  "refund_info",
  "openType",
  "raw_request",
  "biz_content",
  "wallet_reference_data",
]);

export type SignableRequest = Record<string, unknown> & {
  biz_content?: Record<string, unknown>;
};

/**
 * Flatten, sort, join -- the exact string the gateway will reproduce and verify.
 *
 * Sorting is by UTF-16 code unit, which is what a bare Array.sort() does and
 * what the JavaScript sample relies on. Do not be tempted to copy the C# sample
 * here: it swaps payee_identifier and payee_identifier_type by hand, which is a
 * workaround for .NET's culture-aware string comparison reordering them, not
 * something the protocol asks for.
 */
export function signOriginString(request: SignableRequest): string {
  const flat = new Map<string, string>();

  const take = (source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      if (EXCLUDED.has(key)) continue;
      if (value === null || value === undefined) continue;
      if (typeof value === "object") continue;
      flat.set(key, String(value));
    }
  };

  take(request);
  if (request.biz_content) take(request.biz_content);

  return [...flat.keys()]
    .sort()
    .map((key) => `${key}=${flat.get(key)}`)
    .join("&");
}

/**
 * Ethio Telecom hands out the key as bare base64 with no PEM armour, but Node's
 * crypto only takes PEM or DER. Accepts either, plus the escaped-newline form a
 * PEM ends up in once it has been through a .env file.
 */
export function toPrivateKeyPem(key: string): string {
  const cleaned = key.trim().replace(/\\n/g, "\n");

  if (cleaned.includes("-----BEGIN")) return cleaned;

  const body = cleaned.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";

  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

/**
 * RSA-PSS, SHA-256, MGF1-SHA-256, salt length equal to the digest.
 *
 * The field is called `sign_type: "SHA256WithRSA"` and the prose in the
 * integration guide says "SHA256RSA", both of which read as PKCS#1 v1.5. It is
 * not PKCS#1. Ethio Telecom's own samples settle it: the JavaScript uses
 * jsrsasign's "SHA256withRSAandMGF1", the Java explicitly selects
 * "SHA256withRSA/PSS" with the plain variant commented out beside it, the C#
 * passes RSASignaturePadding.Pss, and the PHP sets an MGF hash. Only their
 * Python sample uses PKCS1_v1_5, and it is the odd one out.
 */
export function signString(text: string, privateKey: string): string {
  return crypto
    .sign("sha256", Buffer.from(text, "utf8"), {
      key: toPrivateKeyPem(privateKey),
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString("base64");
}

export function signRequest(
  request: SignableRequest,
  privateKey: string,
): string {
  return signString(signOriginString(request), privateKey);
}

/** 32 alphanumerics, matching the sample's UUID-with-dashes-stripped. */
export function createNonceStr(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Ethio Telecom's demo sends Date.now(), so milliseconds, while every worked
 * example in their documentation shows a ten-digit value and the field is
 * described as seconds. The demo is the artefact that is known to work against
 * the testbed, so it wins -- but the disagreement is real, so if live calls come
 * back rejected on the timestamp, this is the one line to change.
 */
export function createTimeStamp(): string {
  return String(Date.now());
}
