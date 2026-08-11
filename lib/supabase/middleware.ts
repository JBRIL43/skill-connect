import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "./env";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/auth",
  "/company-profile",
  "/readiness",
  // Telebirr POSTs here from their own servers with no session. Without this it
  // would be redirected to /login, and a 307 is indistinguishable from success
  // at their end -- the payment would simply never be recorded. The route
  // authenticates the notification by asking the gateway about the order rather
  // than by trusting the caller.
  "/api/payments/telebirr/notify",
  // Token-gated outgoing-employee interview (Dev 2 Phase 6). Auth is enforced
  // by HANDOVER_SIGNING_SECRET HMAC, not Supabase session. See
  // docs/INTEGRATION_NOTES.md.
  "/handover",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the auth cookie on every request and bounces signed-out users away
 * from private routes. Role-based routing happens in the layouts, which can
 * read profiles.role without adding a database round trip to every asset.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser revalidates the token with Supabase. Do not swap it for getSession,
  // which trusts whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
