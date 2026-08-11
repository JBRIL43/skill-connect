import { NextResponse } from "next/server";

import { reconcilePayment } from "@/lib/payments/orders";

/**
 * POST /api/payments/telebirr/notify
 *
 * Telebirr's payment callback, sent from their servers to the notify_url given
 * at pre-order. Public by necessity: there is no session on it, which is why
 * lib/supabase/middleware.ts has to let it past.
 *
 * The body is treated as a hint, never as proof. It carries a signature, but
 * verifying it needs Telebirr's public key and the portal only issues ours --
 * so anyone who learns the URL could post a convincing-looking success. All
 * this route takes from the body is which order to go and ask about;
 * reconcilePayment then calls queryOrder over an authenticated channel and only
 * settles the row if the gateway itself says PAY_SUCCESS. A forged callback
 * therefore achieves nothing beyond an extra queryOrder.
 *
 * Idempotent, because Telebirr will resend a notification it thinks was missed.
 */

// node:crypto for RSA signing, and the scoped undici dispatcher for the
// testbed's certificate. Neither works on the Edge runtime.
export const runtime = "nodejs";

type NotifyBody = {
  merch_order_id?: string;
  trade_status?: string;
  payment_order_id?: string;
};

export async function POST(request: Request) {
  let body: NotifyBody = {};

  // Documented as JSON, but a gateway that posts form-encoded on some paths is
  // common enough to be worth surviving rather than 500ing on.
  try {
    const raw = await request.text();
    body = raw.trim().startsWith("{")
      ? (JSON.parse(raw) as NotifyBody)
      : (Object.fromEntries(new URLSearchParams(raw)) as NotifyBody);
  } catch {
    return NextResponse.json({ result: "FAIL", msg: "unreadable body" }, { status: 400 });
  }

  const externalRef = body.merch_order_id;

  if (!externalRef) {
    return NextResponse.json(
      { result: "FAIL", msg: "no merch_order_id" },
      { status: 400 },
    );
  }

  try {
    const outcome = await reconcilePayment(externalRef);

    if (!outcome.found) {
      // Ours to investigate, not theirs to retry: retrying will not conjure a
      // row. 200 so the gateway stops resending.
      console.warn(`[telebirr] notification for unknown order ${externalRef}`);
      return NextResponse.json({ result: "SUCCESS", code: "0", msg: "ignored" });
    }

    console.info(
      `[telebirr] ${externalRef}: paid=${outcome.paid}` +
        (outcome.alreadyPaid ? " (already settled)" : ""),
    );

    return NextResponse.json({ result: "SUCCESS", code: "0", msg: "success" });
  } catch (error) {
    // A 500 is the right answer here: something on our side failed, and a
    // retry from Telebirr is exactly what we want.
    console.error(`[telebirr] failed to reconcile ${externalRef}`, error);
    return NextResponse.json(
      { result: "FAIL", msg: "could not reconcile" },
      { status: 500 },
    );
  }
}
