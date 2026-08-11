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

export default function SandboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sandbox] page error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="panel w-full max-w-md">
        <CardHeader className="gap-4">
          <CardTitle>Sandbox could not load</CardTitle>
          <CardDescription>
            {error.message.includes("supabase") || error.message.includes("database")
              ? "The database connection failed. Check that NEXT_PUBLIC_DATA_SOURCE and SUPABASE_SERVICE_ROLE_KEY are set, or switch to mock mode."
              : "Something went wrong loading the Sandbox. Your scores and badges are safe."}
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              Try again
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
