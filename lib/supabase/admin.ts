import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Bypasses RLS entirely. Only for the admin console, the notification check,
 * the seed-data action, the payment webhook, and continuity-brief writes from
 * the token-gated handover interview (no client write policy by design) —
 * all server-side.
 *
 * Never import this into a client component or a route a non-admin can reach.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient was called in the browser. The service role key must never reach the client.",
    );
  }

  return createSupabaseClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
