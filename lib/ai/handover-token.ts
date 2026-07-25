import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 60 * 60 * 72; // 72 hours

function signingSecret() {
  const secret = process.env.HANDOVER_SIGNING_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "HANDOVER_SIGNING_SECRET is not configured (min 16 characters)",
    );
  }
  return secret;
}

function toBase64Url(value: Buffer | string) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64").toString("utf8");
}

function signPayload(payload: string) {
  return toBase64Url(
    createHmac("sha256", signingSecret()).update(payload).digest(),
  );
}

export type HandoverTokenClaims = {
  postingId: string;
  exp: number;
};

export function createHandoverToken(
  postingId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  const claims: HandoverTokenClaims = {
    postingId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = toBase64Url(JSON.stringify(claims));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyHandoverToken(
  token: string,
  expectedPostingId: string,
): { ok: true; claims: HandoverTokenClaims } | { ok: false; error: string } {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) {
    return { ok: false, error: "Malformed invitation token" };
  }

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(payload);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Signing secret missing",
    };
  }

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, error: "Invalid invitation token" };
  }

  let claims: HandoverTokenClaims;
  try {
    claims = JSON.parse(fromBase64Url(payload)) as HandoverTokenClaims;
  } catch {
    return { ok: false, error: "Malformed invitation token" };
  }

  if (
    typeof claims.postingId !== "string" ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp)
  ) {
    return { ok: false, error: "Malformed invitation token" };
  }

  if (claims.postingId !== expectedPostingId) {
    return { ok: false, error: "Invitation token does not match this posting" };
  }

  if (claims.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "Invitation link has expired" };
  }

  return { ok: true, claims };
}

export function handoverInvitePath(postingId: string, token: string) {
  return `/handover/${postingId}?token=${encodeURIComponent(token)}`;
}
