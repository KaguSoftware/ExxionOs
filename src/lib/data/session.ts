import { redirect } from "next/navigation";
import { cache } from "react";

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Profile, SessionContext } from "@/lib/types";

/**
 * The signed-in context, resolved ONCE per request.
 *
 * cache()-wrapped so the layout, the page and any server component in the same
 * render share one fetch instead of each paying a round-trip.
 *
 * ⚠️ Identity comes from `getClaims()`, never `getUser()`. `getUser()` is a
 * full auth-server round-trip (~300ms); `getClaims()` verifies the JWT locally
 * against the project's JWKS. Only the proxy needs the refreshing variant.
 *
 * ⚠️ THIS FUNCTION DELIBERATELY DOES NOT THROW when the session read fails —
 * unlike every query in this app, which goes through `rowsOrThrow`. A failed
 * session read means *signed out*, and the correct response to signed-out is
 * `redirect("/login")`. Throwing here would crash every route in the app,
 * INCLUDING the error boundary's own way back out. Do not "make this
 * consistent" with query.ts.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const userId = claims.sub as string;
  const email = (claims.email as string | undefined) ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!profile) {
    // The profile row is created by a DB trigger on auth.users insert, so this
    // is only reachable if that trigger was dropped or the row was deleted by
    // hand. Signing out is the honest response: the app cannot function
    // without a profile, and looping through /login would be worse.
    redirect("/login?error=no-profile");
  }

  return {
    userId,
    email,
    profile,
    locale: isLocale(profile.locale) ? profile.locale : DEFAULT_LOCALE,
  };
});

/** Just the id, for actions that don't need the whole profile. */
export async function getUserId(): Promise<string> {
  return (await getSessionContext()).userId;
}
