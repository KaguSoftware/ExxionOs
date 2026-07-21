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

// --- creative --------------------------------------------------------------

export type MaterialKind = "filament" | "resin" | "other";
export type CollectionStatus = "planned" | "in_progress" | "done" | "archived";
export type IdeaStatus = "new" | "exploring" | "dropped" | "made";
export type Severity = "low" | "medium" | "high";

export const COLLECTION_STATUSES: CollectionStatus[] = [
  "planned",
  "in_progress",
  "done",
  "archived",
];
export const IDEA_STATUSES: IdeaStatus[] = ["new", "exploring", "dropped", "made"];
export const SEVERITIES: Severity[] = ["low", "medium", "high"];
export const MATERIAL_KINDS: MaterialKind[] = ["filament", "resin", "other"];

export type Material = {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Integer kuruş per kilogram. */
  cost_per_kg_minor: number;
  color: string | null;
  notes: string | null;
  /**
   * Optional link to the stocked supply this material IS.
   * ⚠️ Null is normal — a material bought per job has no stock to draw down.
   * When set, recording a print run deducts grams from that supply.
   */
  supply_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PrintRun = {
  id: string;
  product_id: string;
  printed_on: string;
  units: number;
  /** Snapshot of what was actually deducted — not recomputed from the product. */
  grams_used: string | number | null;
  supply_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type AppSettings = {
  id: number;
  /** Integer kuruş per hour of machine time. */
  machine_hour_rate_minor: number;
  updated_at: string;
};

export type Collection = {
  id: string;
  name: string;
  description: string | null;
  status: CollectionStatus;
  cover_path: string | null;
  started_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Idea = {
  id: string;
  title: string;
  body: string | null;
  status: IdeaStatus;
  /** Set when promoted, so a collection can point back at the idea it began as. */
  collection_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ⚠️ `grams` and `print_hours` are Postgres `numeric`, which arrives over
 * PostgREST as a STRING. Unit cost is NOT a column — it is computed from these
 * by `lib/costing.ts` at read time.
 */
export type Product = {
  id: string;
  collection_id: string;
  name: string;
  kind: string | null;
  material_id: string | null;
  grams: string | number | null;
  print_hours: string | number | null;
  price_minor: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * The Learnings spine. One table, two lenses: a collection's Issues tab and the
 * app-wide Learnings list.
 *
 * ⚠️ `resolution` IS the solved state — there is no separate boolean, because a
 * flag and a written fix would drift, and "solved" with no explanation teaches
 * nobody.
 */
export type Issue = {
  id: string;
  title: string;
  body: string | null;
  collection_id: string | null;
  product_id: string | null;
  severity: Severity;
  resolution: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredImage = {
  id: string;
  path: string;
  sort_order: number;
};

// --- equipment -------------------------------------------------------------

export type MachineStatus =
  | "operational"
  | "needs_attention"
  | "broken"
  | "retired";
export type MaintenanceKind = "repair" | "service" | "part" | "inspection";

export const MACHINE_STATUSES: MachineStatus[] = [
  "operational",
  "needs_attention",
  "broken",
  "retired",
];
export const MAINTENANCE_KINDS: MaintenanceKind[] = [
  "repair",
  "service",
  "part",
  "inspection",
];
export const SUPPLY_UNITS = ["pcs", "roll", "ml", "l", "g", "kg"] as const;

export type Machine = {
  id: string;
  name: string;
  kind: string | null;
  model: string | null;
  serial: string | null;
  status: MachineStatus;
  location: string | null;
  purchased_on: string | null;
  purchase_price_minor: number | null;
  /**
   * Set only when the user asked for the purchase to be logged in Finance.
   * ⚠️ Null does NOT mean "not bought" — most machines were bought before the
   * system existed and were expensed at the time. See migration 0006.
   */
  purchase_transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ⚠️ `cost_minor` here is the INPUT that creates a Finance transaction — it is
 * NOT the source of truth for the money. `transaction_id` points at the row
 * that is. Never sum `cost_minor` for a total: that double-counts against
 * Finance and drifts the moment someone edits the transaction.
 */
export type MaintenanceLog = {
  id: string;
  machine_id: string;
  performed_on: string;
  kind: MaintenanceKind;
  description: string;
  cost_minor: number | null;
  transaction_id: string | null;
  performed_by: string | null;
  created_at: string;
  updated_at: string;
};

/** `quantity` / `low_threshold` are Postgres numeric — they arrive as strings. */
export type Supply = {
  id: string;
  name: string;
  unit: string;
  quantity: string | number;
  low_threshold: string | number | null;
  last_price_minor: number | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplyRestock = {
  id: string;
  supply_id: string;
  restocked_on: string;
  quantity: string | number;
  cost_minor: number | null;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
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
