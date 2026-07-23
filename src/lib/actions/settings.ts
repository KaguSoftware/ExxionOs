"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionContext } from "@/lib/data/session";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { toMinor } from "@/lib/money";
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

/**
 * Business identity + monthly revenue target, all on app_settings (id=1).
 *
 * ⚠️ `monthlyTarget` null clears the target (a real state — "no target set",
 * not "target of ₺0"). The dashboard renders a "set a target" hint for null.
 */
export async function updateBusinessSettings(input: {
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessInstagram: string | null;
  invoiceFooter: string | null;
  monthlyTarget: number | null;
}): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("app_settings")
    .update({
      business_name: input.businessName?.trim().slice(0, 200) || null,
      business_address: input.businessAddress?.trim().slice(0, 500) || null,
      business_phone: input.businessPhone?.trim().slice(0, 60) || null,
      business_email: input.businessEmail?.trim().slice(0, 200) || null,
      business_instagram:
        input.businessInstagram?.trim().replace(/^@/, "").slice(0, 60) || null,
      invoice_footer: input.invoiceFooter?.trim().slice(0, 500) || null,
      monthly_target_minor:
        input.monthlyTarget == null ? null : Math.abs(toMinor(input.monthlyTarget)),
    })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  // The target renders on the dashboard.
  revalidatePath("/");
  return { ok: true, data: undefined };
}

/** The machine + labour hourly rates. Re-costs every product, so Creative
 *  revalidates too (via the machine-rate path already there). */
export async function updateCostingRates(input: {
  machineRate: number;
  laborRate: number;
}): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("app_settings")
    .update({
      machine_hour_rate_minor: Math.abs(toMinor(input.machineRate || 0)),
      labor_hour_rate_minor: Math.abs(toMinor(input.laborRate || 0)),
    })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  // Re-pricing labour/machine time re-costs every product.
  revalidatePath("/creative");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function updateProfile(input: {
  fullName: string;
}): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const fullName = input.fullName.trim().slice(0, 80);

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", ctx.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
