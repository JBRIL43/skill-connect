import { NextResponse } from "next/server";

/**
 * Middleware only allows authenticated requests to this private route. The
 * global shell probes it before loading the chatbot's client bundle.
 */
export function GET() {
  return NextResponse.json(
    { authenticated: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
