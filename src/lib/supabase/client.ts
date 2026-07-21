import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Safe to call repeatedly — @supabase/ssr memoises internally
 * per set of arguments.
 *
 * ⚠️ Realtime: any subscription must `await supabase.realtime.setAuth(token)`
 * BEFORE `.subscribe()`. Without it the socket is authorized as anon, RLS
 * streams nothing, and the channel still reports SUBSCRIBED — so the symptom
 * is "connected, but I only ever see my own changes".
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
