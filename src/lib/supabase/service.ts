import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES RLS ENTIRELY.
 *
 * ⚠️ Server-only, and only for work that genuinely cannot be done as the
 * signed-in user: reaching another user's rows (e.g. sweeping their
 * notifications when the thing those point at is deleted), or admin-style
 * maintenance. Never import this into a client component, and never use it
 * merely because a query was inconvenient to write under RLS.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — cannot create a service client."
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
