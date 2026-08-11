"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[coach] page error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-4">
          <CardTitle>The coach ran into a problem</CardTitle>
          <CardDescription>
            {error.message.includes("API key") || error.message.includes("GEMINI_API_KEY") || error.message.includes("OPENAI_API_KEY")
              ? "The AI provider is not configured. Set GEMINI_API_KEY (or OPENAI_API_KEY), or set AI_MODE=stub to run offline."
              : "Something went wrong loading the AI coach. Your conversation has not been lost."}
          </CardDescription>
          <Button onClick={reset} variant="outline" className="w-fit">
            Try again
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
