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
export type TransactionSource =
  | "equipment"
  | "supply"
  | "order"
  | "marketing"
  | "client";

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

// --- shipping --------------------------------------------------------------

/**
 * The order lifecycle. Order matters — the board renders these as columns in
 * sequence and cycle-time reads consecutive pairs.
 *
 * ⚠️ `cancelled` is TERMINAL and deliberately part of the same field: an
 * enquiry that never converts must leave the active board without being
 * deleted, or the lost-quote rate is unknowable.
 */
export type OrderStage =
  | "enquiry"
  | "quoted"
  | "printing"
  | "post_processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

/** The working pipeline, in order. Excludes the two terminal stages. */
export const ORDER_FLOW: OrderStage[] = [
  "enquiry",
  "quoted",
  "printing",
  "post_processing",
  "packed",
  "shipped",
];

export const ORDER_STAGES: OrderStage[] = [
  ...ORDER_FLOW,
  "delivered",
  "cancelled",
];

export type PaymentKind = "deposit" | "balance" | "refund";
export const PAYMENT_KINDS: PaymentKind[] = ["deposit", "balance", "refund"];

/**
 * Individual / business / reseller. A reseller's ₺20.000 and a gift buyer's
 * ₺400 are different kinds of number; averaging them describes neither.
 */
export type ClientKind = "individual" | "business" | "reseller";
export const CLIENT_KINDS: ClientKind[] = [
  "individual",
  "business",
  "reseller",
];

/**
 * HOW THEY FOUND EXXION.
 *
 * ⚠️ A FIXED LIST ON PURPOSE. This is the column "which channel actually
 * brings the money" is answered from, and that question is only answerable if
 * the values group — free text gives "insta", "Instagram" and "IG" as three
 * separate channels. `null` is a real and distinct answer ("nobody asked"),
 * which is why the insights panel shows an unknown bucket instead of hiding it.
 */
export type ClientSource =
  | "instagram"
  | "referral"
  | "market"
  | "walk_in"
  | "website"
  | "other";
export const CLIENT_SOURCES: ClientSource[] = [
  "instagram",
  "referral",
  "market",
  "walk_in",
  "website",
  "other",
];

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  city: string | null;
  notes: string | null;
  kind: ClientKind;
  source: ClientSource | null;
  /** Free-form. Analytics reads `source`/`kind`; tags are for FINDING people. */
  tags: string[];
  birthday: string | null;
  address: string | null;
  postal_code: string | null;
  country: string | null;
  /** ⚠️ Clients ARCHIVE, never delete — a past sale must keep its buyer's name. */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ONE `events` table, kind-tagged, TWO lenses — the same shape as
 * `issues` → Learnings, and for the same reason: a client's timeline and
 * Marketing's schedule are two VIEWS of "something happened on a date". Two
 * tables would need syncing and would drift; one table cannot.
 *
 * ⚠️ The Marketing kinds are already valid in the database (migration 0009), so
 * Phase 7 adds a lens, not a migration. Phase 6 renders only the client kinds.
 */
export type EventKind =
  | "call"
  | "meeting"
  | "message"
  | "sample_sent"
  | "complaint"
  | "note"
  | "filming"
  | "networking"
  | "campaign";

/** The kinds Phase 6 offers when logging against a client. */
export const CLIENT_EVENT_KINDS: EventKind[] = [
  "call",
  "meeting",
  "message",
  "sample_sent",
  "complaint",
  "note",
];

/** Reserved for Phase 7's lens over the same table. */
export const MARKETING_EVENT_KINDS: EventKind[] = [
  "filming",
  "networking",
  "campaign",
];

export type Event = {
  id: string;
  kind: EventKind;
  title: string;
  body: string | null;
  /** A DATE — a business fact, not a clock reading. See `todayInIstanbul()`. */
  occurred_on: string;
  /** ⚠️ SET NULL: deleting a client must not delete the record it happened. */
  client_id: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ⚠️ `total_minor` IS THE AGREED PRICE, NOT REVENUE. The money is in
 * `order_payments` (and, authoritatively, in `transactions`). Summing this
 * column would book a quoted-but-never-paid order as income. See
 * `outstandingMinor()` in `lib/shipping.ts`.
 */
export type Order = {
  id: string;
  code: string | null;
  client_id: string | null;
  stage: OrderStage;
  title: string;
  notes: string | null;
  total_minor: number;
  promised_on: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipping_cost_minor: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ⚠️ `description` is denormalised at write time so the line still reads after
 * its product is deleted (`product_id` is SET NULL, never cascade — deleting a
 * design must not rewrite what a past order contained).
 */
export type OrderLine = {
  id: string;
  order_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price_minor: number;
  sort_order: number;
  created_at: string;
};

/** Append-only. `orders.stage` says where; this says when. */
export type OrderStageEvent = {
  id: string;
  order_id: string;
  stage: OrderStage;
  entered_at: string;
  note: string | null;
  created_by: string | null;
};

/**
 * A real receipt of money. ⚠️ `amount_minor` is a positive magnitude; `kind`
 * 'refund' is what makes it an OUT transaction in Finance.
 */
export type OrderPayment = {
  id: string;
  order_id: string;
  paid_on: string;
  amount_minor: number;
  kind: PaymentKind;
  transaction_id: string | null;
  note: string | null;
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
