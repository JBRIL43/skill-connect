import { redirect } from "next/navigation";

import { TelebirrMark } from "@/components/telebirr-mark";
import { requireRole } from "@/lib/auth";
import { PREMIUM_TITLE } from "@/lib/payments/config";
import { findPaymentByRef } from "@/lib/payments/orders";
import { ConfirmForm } from "./confirm-form";

export const metadata = { title: "telebirr checkout" };

/**
 * The mock gateway.
 *
 * Deliberately not wrapped in AppShell: a real checkout happens on the payment
 * provider's own site, so borrowing our header would make it read as part of the
 * app. Full-bleed and centred is both more convincing and more honest about what
 * is being imitated.
 */
export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const profile = await requireRole("sme");
  const { ref } = await searchParams;

  if (!ref) redirect("/dashboard/upgrade");

  const payment = await findPaymentByRef(ref);

  // findPaymentByRef runs as the service role, so ownership is checked here.
  if (!payment || payment.sme_id !== profile.id) redirect("/dashboard/upgrade");
  if (payment.status === "paid") {
    redirect(`/dashboard/upgrade/complete?ref=${ref}`);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between bg-[#00A651] px-5 py-4">
          <TelebirrMark className="bg-white/15" />
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.7rem] font-medium text-white">
            Demo
          </span>
        </div>

        <div className="space-y-1 border-b px-5 py-5 text-center">
          <p className="text-sm text-muted-foreground">Pay Skill-Connect Ethiopia</p>
          <p className="text-3xl font-semibold tabular-nums">
            {payment.amount.toLocaleString()} ETB
          </p>
          <p className="text-xs text-muted-foreground">{PREMIUM_TITLE}</p>
        </div>

        <div className="px-5 py-5">
          <ConfirmForm
            externalRef={ref}
            amount={payment.amount}
            defaultPhone={profile.phone ?? undefined}
          />
        </div>

        <p className="border-t bg-muted/40 px-5 py-3 text-center text-[0.7rem] text-muted-foreground">
          Order {ref}
        </p>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        A styled stand-in for telebirr&rsquo;s checkout, used when the sandbox is
        unavailable. No money moves.
      </p>
    </div>
  );
}
