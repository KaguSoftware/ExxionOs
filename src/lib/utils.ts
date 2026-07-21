import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Locale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- dates -----------------------------------------------------------------

const APP_TIME_ZONE = "Europe/Istanbul";

/**
 * The app's "today" as YYYY-MM-DD, for EVERY domain date.
 *
 * ⚠️ Do NOT use `new Date().toISOString().slice(0, 10)` — that is UTC, and
 * Istanbul is UTC+3, so between 00:00 and 03:00 local it answers *yesterday*.
 * On KaguOs that shipped in nine places and made things due today read as
 * overdue. Do NOT use the machine clock either: on the server that is the
 * Vercel runtime (UTC), which reintroduces the same bug while looking correct.
 */
export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Viewer-local today. NARROW USE ONLY — things that are genuinely about the
 * person looking at the screen, such as a download filename. Never for whether
 * something is overdue: two people must agree on that.
 */
export function todayLocal(): string {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Pure string → string, so no time zone can leak in. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function isOverdue(due: string | null | undefined): boolean {
  return !!due && due < todayInIstanbul();
}

// --- formatting ------------------------------------------------------------

// Farsi uses Persian digits and month names via the `fa` locale; the calendar
// stays Gregorian on purpose, because every date in this system comes from a
// Gregorian-dated business record (invoices, carriers, expos).
const intlLocale: Record<Locale, string> = {
  en: "en-GB",
  fa: "fa-IR-u-ca-gregory",
};

export function formatDate(
  date: string | Date | null | undefined,
  locale: Locale = "en",
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale[locale], opts).format(d);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale = "en"
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

export function formatRelative(
  value: string | Date | null | undefined,
  locale: Locale = "en"
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(0, "minute");
}

/**
 * Money is Turkish lira and always Latin digits, in both locales.
 *
 * Persian digits are correct for prose but wrong for figures here: numbers get
 * compared across rows, copied into invoices and pasted into spreadsheets, and
 * a column mixing ۱۲۳ with 123 is unreadable at a glance.
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an integer number of KURUŞ. This is the one every Finance surface
 * should call, because everything inside the app is already kuruş — a
 * `formatMoney(row.amount_minor)` would silently render ₺125.050,00 for
 * ₺1.250,50, and it would look plausible.
 */
export function formatMinor(minor: number | null | undefined): string {
  if (minor == null || Number.isNaN(minor)) return "—";
  return formatMoney(minor / 100);
}

/**
 * Money with an explicit sign, for the income/expense pair.
 *
 * ⚠️ NOT decoration — REQUIRED. The green/red pair measures ΔE 6.5 under
 * protanopia (the 6–8 "floor band"), which is only legal WITH secondary
 * encoding. This sign IS that encoding: it is what stops the two series from
 * being distinguished by colour alone. Do not strip it to tidy the layout.
 */
export function formatSignedMinor(
  minor: number,
  direction: "in" | "out"
): string {
  return `${direction === "in" ? "+" : "−"}${formatMoney(Math.abs(minor) / 100)}`;
}

/** Bare number, no currency mark — for chart axes and tight tables. */
export function formatNumber(value: number | null | undefined, locale: Locale = "en"): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-GB").format(value);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
