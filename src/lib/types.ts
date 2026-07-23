import type { Locale } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  locale: Locale;
  theme: Theme;
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
  /** True when auto-created by the reminder generator; false = entered by hand. */
  generated: boolean;
  created_at: string;
  updated_at: string;
};

// --- vocabularies ----------------------------------------------------------

/**
 * User-grown label lists. See `supabase/migrations/0011_vocabularies.sql`.
 *
 * ⚠️ A vocabulary row is a REGISTRY entry, never a foreign key. `products.kind`
 * stores the label text itself and `clients.tags` stores an array of label
 * text — this table only remembers which words exist so they can be offered
 * back, renamed, and retired. Nothing breaks if a row references a word that
 * was archived: the word IS the value.
 */
export type VocabularyKind =
  | "product_type"
  | "client_tag"
  | "supply_item";

export const VOCABULARY_KINDS: VocabularyKind[] = [
  "product_type",
  "client_tag",
  "supply_item",
];

export type Vocabulary = {
  id: string;
  kind: VocabularyKind;
  /** The user's own spelling — what gets written onto records. */
  label: string;
  /** Case/whitespace-folded dedupe key. Unique per kind. See `lib/vocab.ts`. */
  slug: string;
  sort_order: number;
  archived_at: string | null;
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

/**
 * What came off the plate.
 *
 * ⚠️ ALL THREE DEDUCT FILAMENT — a failed print burns real material. Only
 * `good` adds sellable units. See `0012_product_stock.sql`.
 */
export type PrintOutcome = "good" | "test" | "failed";
export const PRINT_OUTCOMES: PrintOutcome[] = ["good", "test", "failed"];

export type PrintRun = {
  id: string;
  product_id: string;
  printed_on: string;
  units: number;
  outcome: PrintOutcome;
  /** Snapshot of what was actually deducted — not recomputed from the product. */
  grams_used: string | number | null;
  supply_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockReason = "print_run" | "order" | "sample" | "correction";

/**
 * One row of the append-only stock ledger.
 *
 * ⚠️ On-hand is `sum(delta)` over these rows — never a stored column. See
 * `lib/stock.ts` and `0012_product_stock.sql`.
 */
export type ProductStockMovement = {
  id: string;
  product_id: string;
  /** Signed: positive adds units, negative removes them. Never zero. */
  delta: number;
  reason: StockReason;
  /** The row that caused this. Null means a manual correction. */
  source_id: string | null;
  /**
   * Which application of this source this is: 0 the original, 1 its reversal,
   * 2 the re-application. Part of the idempotency key — see 0012.
   */
  apply_seq: number;
  note: string | null;
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
  /** The supply printed from — its cost_per_kg_minor costs this product. */
  supply_id: string | null;
  grams: string | number | null;
  /**
   * Weighed grams per unit, SUPPORTS INCLUDED — the truth, captured on the first
   * print. Overrides `grams` for stock deduction and costing once set; null
   * means never weighed, fall back to the `grams` estimate. See 0021.
   */
  measured_grams: string | number | null;
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

/**
 * A source/design file attached to a product (.mb / .ma / .stl). A DOWNLOAD,
 * not a thumbnail — the name and size are stored so the list renders without
 * signing a URL per row (SignedFileLink signs at click). See 0020.
 */
export type ProductFile = {
  id: string;
  product_id: string;
  path: string;
  name: string;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
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
  /**
   * When the machine is next due for service. ⚠️ Null = no schedule set (the
   * normal case), not "overdue". Drives an auto-reminder — see 0017.
   */
  next_service_on: string | null;
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
  /**
   * The FINANCE EXPENSE CATEGORY this supply is bought under ("Filament",
   * "Packaging"…). Stored as the category NAME; a restock books its expense
   * here via categoryIdByName(). Null = uncategorised. A category of "Filament"
   * or "Resin" makes the supply a printing material (grams + per-kg cost).
   */
  category: string | null;
  /**
   * The specific item ("Cardboard", "PLA Black"…), backed by the `supply_item`
   * vocabulary. Verbatim, like `products.kind`. Null = unnamed.
   */
  item: string | null;
  unit: string;
  quantity: string | number;
  low_threshold: string | number | null;
  last_price_minor: number | null;
  /**
   * Integer kuruş per kilogram, used to cost the products printed from this
   * supply. ⚠️ Null is normal and means "uncosted" — a box or a roll of tape
   * has no per-kg price, and costing renders that as unknown, never ₺0.
   */
  cost_per_kg_minor: number | null;
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
  /** Optional attribution to the campaign that won this order — see 0019.
   *  Null is the honest default ("no known campaign"); ROI reports only over
   *  tagged orders. SET NULL, so archiving a campaign never deletes the sale. */
  campaign_id: string | null;
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

// --- marketing (phase 7) ---------------------------------------------------

export type CampaignChannel =
  | "instagram"
  | "tiktok"
  | "market"
  | "collab"
  | "print"
  | "other";
export const CAMPAIGN_CHANNELS: CampaignChannel[] = [
  "instagram",
  "tiktok",
  "market",
  "collab",
  "print",
  "other",
];

/** 'cancelled' is terminal, and lives here for the same reason `orders.stage`
 *  keeps it: a campaign that was called off must leave the active list without
 *  being deleted, or you cannot tell how many plans never happened. */
export type CampaignStatus = "planned" | "running" | "done" | "cancelled";
export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "planned",
  "running",
  "done",
  "cancelled",
];

/**
 * ⚠️ `budget_minor` IS THE PLAN, NOT THE MONEY. Actual spend is the sum of the
 * `transactions` rows tagged `source_type='marketing'` — exactly the
 * relationship `orders.total_minor` has to `order_payments`. A campaign planned
 * at ₺5.000 that never ran spent ₺0. See `lib/marketing.ts`.
 */
export type Campaign = {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  goal: string | null;
  budget_minor: number;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  /** ⚠️ Campaigns ARCHIVE, never delete — costs and samples point at them. */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One itemised spend against a campaign. Each writes ONE Finance transaction.
 *
 * ⚠️ `transaction_id` is the ONLY link, and it is `on delete set null`. Store
 * what `syncTransaction()` returns, or the next edit creates a second
 * transaction instead of updating the first.
 */
export type CampaignCost = {
  id: string;
  campaign_id: string;
  label: string;
  amount_minor: number;
  spent_on: string;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * Something given away.
 *
 * ⚠️ A SAMPLE IS COSTED, NEVER EXPENSED — it writes NO Finance transaction.
 * The filament was expensed when it was bought; charging again when it is
 * given away counts the same lira twice. Its value comes from `productCost()`
 * at read time, like every other cost in this app. See `lib/marketing.ts`.
 *
 * ⚠️ `description` is denormalised at write time so the row still reads after
 * its product is deleted (`product_id` is SET NULL) — like `OrderLine`.
 */
export type Sample = {
  id: string;
  product_id: string | null;
  description: string;
  client_id: string | null;
  campaign_id: string | null;
  recipient: string | null;
  quantity: number;
  given_on: string;
  notes: string | null;
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
