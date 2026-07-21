"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionContext } from "@/lib/data/session";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE, isTheme } from "@/lib/theme";
import type { ActionResult, Theme } from "@/lib/types";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
} as const;

/**
 * Preferences are written to BOTH the profile row and a cookie.
 *
 * The row is the durable record (it follows you to a new device); the cookie
 * is what the root layout reads, so the very first byte of HTML already has
 * the right `dir` and theme. Without the cookie the server would have to load
 * the session before it could render `<html>`, which puts a database
 * round-trip in front of every first paint — including on /login, where there
 * is no session at all.
 */
export async function updatePreferences(input: {
  locale?: Locale;
  theme?: Theme;
}): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const patch: { locale?: Locale; theme?: Theme } = {};
  if (input.locale && isLocale(input.locale)) patch.locale = input.locale;
  if (input.theme && isTheme(input.theme)) patch.theme = input.theme;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", ctx.userId);

  if (error) {
    // ⚠️ "permission denied for table profiles" here almost always means a
    // MISSING COLUMN GRANT, not an RLS problem — see migration 0001.
    return { ok: false, error: error.message };
  }

  const store = await cookies();
  if (patch.locale) store.set(LOCALE_COOKIE, patch.locale, COOKIE_OPTIONS);
  if (patch.theme) store.set(THEME_COOKIE, patch.theme, COOKIE_OPTIONS);

  // Locale and theme change the html element, so the whole tree re-renders.
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function updateProfile(input: {
  fullName: string;
  color: string;
}): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const fullName = input.fullName.trim().slice(0, 80);
  // Validate the colour rather than trusting the client: this string is
  // interpolated into a style attribute downstream.
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : null;
  if (!color) return { ok: false, error: "That colour isn't valid." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, color })
    .eq("id", ctx.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
