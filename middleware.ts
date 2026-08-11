import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // With mock data there is no Supabase project to refresh a session against,
  // and updateSession throws on the missing keys before any page can render.
  // Only the literal string 'mock' skips it: an unset variable used to skip it
  // too, which meant a deployment that never refreshed an expired token and
  // logged people out mid-session about an hour after they signed in.
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock") {
    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
