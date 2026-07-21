"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LOCALE_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";
import type { ActionResult } from "@/lib/types";

export async function signIn(
  email: string,
  password: string
): Promise<ActionResult<{ locale: string; theme: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    // Deliberately does NOT distinguish "no such account" from "wrong
    // password": that difference tells an attacker which addresses exist.
    return { ok: false, error: "invalid" };
  }

  // Seed the preference cookies from the profile immediately, so the first
  // page after login already renders in the right language and theme rather
  // than flashing English/dark for one navigation.
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale, theme")
    .eq("id", data.user.id)
    .maybeSingle<{ locale: string; theme: string }>();

  const store = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" } as const;
  if (profile?.locale) store.set(LOCALE_COOKIE, profile.locale, opts);
  if (profile?.theme) store.set(THEME_COOKIE, profile.theme, opts);

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { locale: profile?.locale ?? "en", theme: profile?.theme ?? "system" },
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Preference cookies are deliberately LEFT in place: they hold no personal
  // data, and clearing them would drop the login page back to English for
  // someone who reads Farsi.
  revalidatePath("/", "layout");
  redirect("/login");
}
