"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  findPaymentByRef,
  reconcilePayment,
  startUpgrade,
} from "@/lib/payments/orders";

export type UpgradeState = { error?: string };

/**
 * Every action here re-checks the caller. A server action is a public POST
 * endpoint, so "the button only renders for an SME" protects nothing, and these
 * particular actions decide who gets premium.
 */

export async function startUpgradeAction(
  _prev: UpgradeState,
  _formData: FormData,
): Promise<UpgradeState> {
  const profile = await requireRole("sme");

  let redirectUrl: string;

  try {
    ({ redirectUrl } = await startUpgrade(profile.id));
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not reach the payment provider.",
    };
  }

  // Outside the try: redirect() signals by throwing, so catching around it would
  // swallow the navigation and report it as a provider failure.
  redirect(redirectUrl);
}

export async function confirmPaymentAction(
  _prev: UpgradeState,
  formData: FormData,
): Promise<UpgradeState> {
  const profile = await requireRole("sme");
  const ref = formData.get("ref");

  if (typeof ref !== "string" || !ref) {
    return { error: "That checkout link is missing its order number." };
  }

  const payment = await findPaymentByRef(ref);

  // Without this an SME could settle somebody else's pending order by pasting
  // their reference, since the reconcile below runs as the service role.
  if (!payment || payment.sme_id !== profile.id) {
    return { error: "That order does not belong to this account." };
  }

  const result = await reconcilePayment(ref);

  if (!result.paid) {
    return {
      error: result.detail ?? "The payment has not gone through yet.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upgrade");
  redirect(`/dashboard/upgrade/complete?ref=${ref}`);
}

/**
 * Used by the completion screen while it waits on a provider that settles out of
 * band. Returns rather than redirects, so the screen can keep polling.
 */
export async function refreshPaymentAction(ref: string): Promise<boolean> {
  const profile = await requireRole("sme");
  const payment = await findPaymentByRef(ref);

  if (!payment || payment.sme_id !== profile.id) return false;
  if (payment.status === "paid") return true;

  const result = await reconcilePayment(ref);

  if (result.paid) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upgrade");
  }

  return result.paid;
}
