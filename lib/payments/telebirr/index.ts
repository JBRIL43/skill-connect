import "server-only";

import type {
  CheckoutRequest,
  CheckoutSession,
  ConfirmResult,
  PaymentProviderAdapter,
} from "../types";
import { postSigned } from "./client";
import { telebirrConfig } from "./config";
import { createNonceStr, createTimeStamp, signRequest } from "./sign";

/**
 * Telebirr C2B Web Checkout, built from Ethio Telecom's own integration guide
 * rather than a community SDK.
 *
 * Three steps: take a fabric token, create a pre-order to get a prepay_id, then
 * hand the browser a signed paygate URL built from it. Confirmation comes from
 * queryOrder rather than from trusting the webhook -- see confirm() below.
 */

type PreOrderResult = { merch_order_id: string; prepay_id: string };

type QueryOrderResult = {
  merch_order_id: string;
  /** The docs list both; their own example only returns order_status. */
  order_status?: string;
  trade_status?: string;
  payment_order_id?: string;
  trans_id?: string;
  total_amount?: string;
};

async function preOrder(request: CheckoutRequest): Promise<string> {
  const config = telebirrConfig();

  const response = await postSigned<PreOrderResult>(
    "/payment/v1/merchant/preOrder",
    "payment.preorder",
    {
      notify_url: config.notifyUrl,
      // Fixed at pre-order time, so the reference has to be carried on it --
      // Telebirr sends the browser back with no way to say which order it was.
      redirect_url: `${config.returnUrl}?ref=${request.externalRef}`,
      appid: config.merchantAppId,
      merch_code: config.merchantCode,
      merch_order_id: request.externalRef,
      trade_type: "Checkout",
      title: request.title,
      total_amount: String(request.amount),
      trans_currency: "ETB",
      timeout_express: "120m",
      business_type: "BuyGoods",
      payee_identifier: config.merchantCode,
      payee_identifier_type: "04",
      payee_type: "5000",
    },
  );

  const prepayId = response.biz_content?.prepay_id;

  if (!prepayId) {
    throw new Error(
      `Telebirr declined the order: ${response.msg ?? "no prepay_id returned"}` +
        (response.code ? ` (code ${response.code})` : ""),
    );
  }

  return prepayId;
}

/**
 * Step 3, the paygate redirect.
 *
 * Signed with the same signer as the pre-order, over five fields rather than the
 * whole envelope. Two details look like mistakes and are not: `version` and
 * `trade_type` are appended after `sign` and are deliberately outside it, and
 * the base64 signature goes in unencoded.
 *
 * So this builds the query string by hand. URLSearchParams would percent-encode
 * the `+`, `/` and `=` in the signature, and Ethio Telecom's working sample does
 * not -- their gateway is reading what their own demo produces.
 */
function checkoutUrl(prepayId: string): string {
  const config = telebirrConfig();

  const fields = {
    appid: config.merchantAppId,
    merch_code: config.merchantCode,
    nonce_str: createNonceStr(),
    prepay_id: prepayId,
    timestamp: createTimeStamp(),
  };

  const sign = signRequest(fields, config.privateKey);

  const rawRequest = [
    `appid=${fields.appid}`,
    `merch_code=${fields.merch_code}`,
    `nonce_str=${fields.nonce_str}`,
    `prepay_id=${fields.prepay_id}`,
    `timestamp=${fields.timestamp}`,
    `sign=${sign}`,
    "sign_type=SHA256WithRSA",
  ].join("&");

  return `${config.webCheckoutUrl}${rawRequest}&version=1.0&trade_type=Checkout`;
}

export const telebirrProvider: PaymentProviderAdapter = {
  name: "telebirr",
  settlesOutOfBand: true,

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const prepayId = await preOrder(request);
    return { redirectUrl: checkoutUrl(prepayId) };
  },

  /**
   * Asks the gateway directly instead of believing the webhook.
   *
   * Two reasons. We cannot verify the callback's signature -- that needs
   * Telebirr's public key, and the portal only issues ours -- so an unverified
   * POST is a hint that something happened, not proof of payment. And the
   * testbed never sends a real USSD prompt: orders simply go through after
   * roughly thirty seconds, which the completion screen polls for.
   */
  async confirm(externalRef: string): Promise<ConfirmResult> {
    const config = telebirrConfig();

    const response = await postSigned<QueryOrderResult>(
      "/payment/v1/merchant/queryOrder",
      "payment.queryorder",
      {
        appid: config.merchantAppId,
        merch_code: config.merchantCode,
        merch_order_id: externalRef,
      },
    );

    const order = response.biz_content;
    const status = order?.trade_status ?? order?.order_status;

    if (status !== "PAY_SUCCESS") {
      return {
        paid: false,
        detail: describe(status ?? response.msg ?? "no status returned"),
      };
    }

    return {
      paid: true,
      providerTxId: order?.payment_order_id ?? order?.trans_id,
    };
  },
};

/** Turns a gateway status into something an SME can act on. */
function describe(status: string): string {
  switch (status) {
    case "WAIT_PAY":
    case "PAYING":
      return "Waiting for the payment to be confirmed on telebirr.";
    case "PAY_FAILED":
      return "telebirr reported the payment as failed or expired.";
    case "ORDER_CLOSED":
      return "This order was closed before it was paid.";
    default:
      return `telebirr reported: ${status}`;
  }
}
