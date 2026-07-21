import type { Locale } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  locale: Locale;
  theme: Theme;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  owner_id: string;
  body: string;
  due_on: string | null;
  done_at: string | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

// --- finance ---------------------------------------------------------------

export type Direction = "in" | "out";
export type CategoryKind = "income" | "expense";
export type Cadence = "monthly" | "quarterly" | "yearly";

export const CADENCES: Cadence[] = ["monthly", "quarterly", "yearly"];

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ⚠️ `amount_minor` is an integer number of KURUŞ and always POSITIVE —
 * `direction` carries the sign. Use `signedMinor()` / `netMinor()` from
 * `lib/money.ts` to total them, and `formatMinor()` to display.
 */
export type Transaction = {
  id: string;
  occurred_on: string;
  direction: Direction;
  amount_minor: number;
  description: string;
  category_id: string | null;
  note: string | null;
  receipt_path: string | null;
  /** The cross-section back-link: what caused this row. */
  source_type: string | null;
  source_id: string | null;
  /** Set when produced by a recurring template; null = entered by hand. */
  recurring_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringItem = {
  id: string;
  label: string;
  direction: Direction;
  amount_minor: number;
  category_id: string | null;
  cadence: Cadence;
  day_of_month: number;
  starts_on: string;
  ends_on: string | null;
  last_generated_on: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Which section created a transaction. Extended as phases 4-7 land; the DB
 * column is deliberately loose text so adding one needs no migration.
 */
export type TransactionSource = "equipment" | "shipping" | "marketing" | "client";

/** The signed-in context every page and action resolves once per request. */
export type SessionContext = {
  userId: string;
  email: string;
  profile: Profile;
  locale: Locale;
};

/**
 * The shape every server action returns. A discriminated union so the client
 * can't read `.data` without first checking `.ok`.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

/**
 * Twenty vibrant, well-separated swatches for member identity colours. Picked
 * to stay distinguishable on both themes and to avoid colliding with the
 * reserved state vocabulary (success green / warning amber / danger red).
 */
export const MEMBER_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#0ea5e9", "#06b6d4",
  "#14b8a6", "#10b981", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#7c3aed", "#2563eb",
  "#0891b2", "#059669", "#ca8a04", "#e11d48",
] as const;
