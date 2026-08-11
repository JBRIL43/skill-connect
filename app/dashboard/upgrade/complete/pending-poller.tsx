"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { refreshPaymentAction } from "../actions";

const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

/**
 * Waits for a provider that settles out of band.
 *
 * Telebirr's testbed does not send a real USSD prompt -- an order simply becomes
 * Completed on their side, typically within about thirty seconds -- and their
 * webhook cannot reach a laptop. So the completion screen asks, rather than
 * waiting to be told. Roughly a minute of polling, then it hands over to a
 * button so the screen never sits there spinning forever on stage.
 */
export function PendingPoller({ externalRef }: { externalRef: string }) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkOnce = useCallback(async () => {
    setChecking(true);
    try {
      const paid = await refreshPaymentAction(externalRef);
      if (paid) router.refresh();
      return paid;
    } finally {
      setChecking(false);
    }
  }, [externalRef, router]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      attempts += 1;

      const paid = await refreshPaymentAction(externalRef).catch(() => false);
      if (cancelled) return;

      if (paid) {
        router.refresh();
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        setWaiting(false);
        return;
      }

      timer = setTimeout(tick, INTERVAL_MS);
    };

    timer = setTimeout(tick, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [externalRef, router]);

  if (waiting) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Waiting for telebirr to confirm…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        No confirmation yet. This can happen if the payment was cancelled or is
        still queued on telebirr&rsquo;s side.
      </p>
      <Button variant="outline" disabled={checking} onClick={() => void checkOnce()}>
        {checking ? "Checking…" : "Check again"}
      </Button>
    </div>
  );
}
