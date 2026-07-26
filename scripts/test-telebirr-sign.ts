/**
 * Checks the Telebirr request signer against Ethio Telecom's own worked example.
 *
 *   npm run test:sign
 *
 * Signing is the single most likely thing to be wrong in this integration, and
 * the gateway's entire diagnostic vocabulary for it is "verify sign failed". So
 * the deterministic half gets pinned here, offline, before anything is sent.
 *
 * The signature bytes themselves cannot be compared to the published example:
 * PSS salts every signature randomly, so signing the same string twice with the
 * same key gives two different results. What is checked instead is the string
 * being signed -- which is where the real ambiguity lives -- plus a
 * sign-then-verify round trip proving the PSS parameters are internally
 * consistent, and that the key format we were issued actually loads.
 */

import crypto from "node:crypto";

import {
  createNonceStr,
  signOriginString,
  signString,
  toPrivateKeyPem,
  type SignableRequest,
} from "../lib/payments/telebirr/sign";

let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
    failed += 1;
  }
}

// ---------------------------------------------------------------------------
// The worked example, copied from the "RequestSignatureProcess" page of the
// H5 C2B guide. Both the request object and the string it is documented to
// produce, so any drift in flattening or ordering shows up here.
// ---------------------------------------------------------------------------

const DOC_REQUEST: SignableRequest = {
  timestamp: "1755866911",
  nonce_str: "H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS",
  method: "payment.preorder",
  version: "1.0",
  biz_content: {
    notify_url: "https://www.google.com",
    appid: "1227484825753601",
    merch_code: "101011",
    merch_order_id: "1755866910890",
    trade_type: "Checkout",
    title: "diamond_1.5",
    total_amount: "1.5",
    trans_currency: "ETB",
    timeout_express: "120m",
  },
};

const DOC_ORIGIN_STRING =
  "appid=1227484825753601&merch_code=101011&merch_order_id=1755866910890" +
  "&method=payment.preorder&nonce_str=H5QN4M6EAB2TXXVFK8SVV0RW6UFASICS" +
  "&notify_url=https://www.google.com&timeout_express=120m" +
  "&timestamp=1755866911&title=diamond_1.5&total_amount=1.5" +
  "&trade_type=Checkout&trans_currency=ETB&version=1.0";

console.log("\nThe string we sign matches the published example");

const produced = signOriginString(DOC_REQUEST);

check("origin string is byte-for-byte identical", produced === DOC_ORIGIN_STRING);

if (produced !== DOC_ORIGIN_STRING) {
  console.log(`        expected: ${DOC_ORIGIN_STRING}`);
  console.log(`        produced: ${produced}`);
}

check(
  "biz_content is flattened, not nested",
  produced.includes("appid=1227484825753601") && !produced.includes("biz_content="),
);

check(
  "sign and sign_type are excluded",
  !signOriginString({ ...DOC_REQUEST, sign: "x", sign_type: "SHA256WithRSA" }).includes(
    "sign=",
  ),
);

// ---------------------------------------------------------------------------
// Ordering, specifically the pair the C# sample has to hand-swap.
// ---------------------------------------------------------------------------

console.log("\nOrdering holds for the awkward keys");

const payeeOrder = signOriginString({
  biz_content: {
    payee_identifier_type: "04",
    payee_identifier: "961125",
    appid: "1",
  },
});

check(
  "payee_identifier sorts before payee_identifier_type",
  payeeOrder === "appid=1&payee_identifier=961125&payee_identifier_type=04",
  payeeOrder,
);

// ---------------------------------------------------------------------------
// The signature itself. Round-tripped against a throwaway key, since we cannot
// verify against Telebirr's copy of our public key from here.
// ---------------------------------------------------------------------------

console.log("\nSignatures verify under the parameters we claim to use");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const pkcs8 = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

const signature = signString(DOC_ORIGIN_STRING, pkcs8);

check(
  "verifies as RSA-PSS with SHA-256 and a digest-length salt",
  crypto.verify(
    "sha256",
    Buffer.from(DOC_ORIGIN_STRING, "utf8"),
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    Buffer.from(signature, "base64"),
  ),
);

check(
  "does NOT verify as PKCS#1 v1.5, which the field name suggests",
  !crypto.verify(
    "sha256",
    Buffer.from(DOC_ORIGIN_STRING, "utf8"),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(signature, "base64"),
  ),
);

check("signature is base64", /^[A-Za-z0-9+/]+={0,2}$/.test(signature));

check(
  "PSS salts randomly, so two signatures differ",
  signString(DOC_ORIGIN_STRING, pkcs8) !== signature,
);

// ---------------------------------------------------------------------------
// Key loading. Ethio Telecom issues bare base64 with no PEM armour.
// ---------------------------------------------------------------------------

console.log("\nKey parsing accepts every shape we might be handed");

const bare = pkcs8
  .replace(/-----[A-Z ]+-----/g, "")
  .replace(/\s+/g, "");

check("bare base64 is armoured correctly", (() => {
  try {
    crypto.createPrivateKey(toPrivateKeyPem(bare));
    return true;
  } catch {
    return false;
  }
})());

check("an already-armoured PEM is left alone", (() => {
  try {
    crypto.createPrivateKey(toPrivateKeyPem(pkcs8));
    return true;
  } catch {
    return false;
  }
})());

check("a PEM with escaped newlines is repaired", (() => {
  try {
    crypto.createPrivateKey(toPrivateKeyPem(pkcs8.replace(/\n/g, "\\n")));
    return true;
  } catch {
    return false;
  }
})());

/**
 * Says what is wrong with a key without ever echoing it.
 *
 * "DECODER routines::unsupported" is all OpenSSL offers when a key will not
 * load, and it covers everything from a truncated paste to the wrong PKCS
 * flavour. Since the obvious next move -- print it and look -- is one nobody
 * should make with a signing key, the classification happens here instead.
 */
function classifyPrivateKey(raw: string): string {
  const cleaned = raw.trim().replace(/\\n/g, "\n");
  const body = cleaned.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    return "contains characters that are not base64, so it was mangled in transit";
  }

  if (body.length % 4 !== 0) {
    return "base64 length is not a multiple of 4, so the paste is incomplete";
  }

  const der = Buffer.from(body, "base64");

  if (der.length < 4 || der[0] !== 0x30) {
    return "does not begin with an ASN.1 SEQUENCE, so it is not a DER key at all";
  }

  // 0x30 0x82 <hi> <lo> is the long-form length every 2048-bit key uses.
  if (der[1] === 0x82) {
    const declared = der.readUInt16BE(2) + 4;
    if (declared !== der.length) {
      return declared > der.length
        ? `truncated: the structure declares ${declared} bytes but only ${der.length} arrived`
        : `has ${der.length - declared} trailing bytes past the end of the key`;
    }
  }

  for (const label of ["PRIVATE KEY", "RSA PRIVATE KEY"] as const) {
    try {
      crypto.createPrivateKey(
        `-----BEGIN ${label}-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END ${label}-----\n`,
      );
      return label === "PRIVATE KEY"
        ? "loads as PKCS#8"
        : "is PKCS#1, not PKCS#8 -- toPrivateKeyPem needs the RSA armour";
    } catch {
      // try the next flavour
    }
  }

  return "is well-formed DER but OpenSSL will not load it under either PKCS armour";
}

// The key we were actually issued, if it is configured. Never printed.
const configured = process.env.TELEBIRR_PRIVATE_KEY;

if (configured) {
  let loaded = false;
  try {
    crypto.createPrivateKey(toPrivateKeyPem(configured));
    loaded = true;
  } catch {
    loaded = false;
  }

  check(
    "the configured TELEBIRR_PRIVATE_KEY loads",
    loaded,
    loaded ? undefined : `the key ${classifyPrivateKey(configured)}`,
  );
} else {
  console.log("  SKIP  TELEBIRR_PRIVATE_KEY is not set");
}

console.log("\nNonces");

const nonce = createNonceStr();
check("nonce is 32 alphanumerics", /^[A-Za-z0-9]{32}$/.test(nonce), nonce);
check("nonces are not repeated", createNonceStr() !== nonce);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log("\nAll signing checks passed.");
