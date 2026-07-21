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
