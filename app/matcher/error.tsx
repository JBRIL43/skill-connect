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

export default function MatcherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[matcher] page error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="panel w-full max-w-md">
        <CardHeader className="gap-4">
          <CardTitle>Matcher could not load</CardTitle>
          <CardDescription>
            Something went wrong loading your templates and postings. Your
            templates and match history are safe.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              Try again
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
              Back to dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
