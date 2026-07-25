import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // With mock data there is no Supabase project to refresh a session against,
  // and updateSession throws on the missing keys before any page can render.
  // Auth is fully enforced whenever NEXT_PUBLIC_DATA_SOURCE is 'supabase'.
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase") {
    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
