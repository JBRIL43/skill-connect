"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] page error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-4">
          <CardTitle>Dashboard could not load</CardTitle>
          <CardDescription>
            Something went wrong. Your account and data are safe — this is a
            temporary display error.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              Try again
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
