import { productCost } from "@/lib/costing";
import type {
  Client,
  ClientKind,
  ClientSource,
  EventKind,
  Order,
  Product,
  Supply,
  Transaction,
} from "@/lib/types";

/**
 * Client analytics. Pure — no React, no Supabase — so the arithmetic is
 * directly testable, which for money it must be. Same reasoning as
 * `lib/shipping.ts`, `lib/finance-series.ts` and `lib/costing.ts`.
 *
 * ⚠️⚠️ THE RULE THIS ENTIRE FILE EXISTS TO ENFORCE:
 *
 *   A CLIENT'S VALUE IS THE MONEY THAT ARRIVED, NOT THE PRICES THEY AGREED TO.
 *
 * `orders.total_minor` is the AGREED PRICE. The money is in `transactions`,
 * written one row per payment (see `recordPayment` in `actions/shipping.ts`).
 * They are routinely different, in both directions:
 *   • A ₺5.000 quote that was never paid has a total and no money. Ranking by
 *     totals would put a client who has paid nothing at the top of "our best
 *     clients" — and Parsa would call them.
 *   • Exxion takes DEPOSITS, so a half-paid order has money without being
 *     finished. Waiting for `delivered` to count it would under-report them.
 * The same family of bug as summing `maintenance_logs.cost_minor` (Phase 4) or
 * `orders.total_minor` for revenue (Phase 5). It was proven wrong twice with
 * real numbers; do not let a later refactor "simplify" it back.
 */

/**
 * Value → i18n key, in one place each, exactly as `STAGE_KEY` is in
 * `lib/shipping.ts`. A component that spells the key inline is one rename away
 * from rendering a raw "sample_sent" at a client.
 */
export const CLIENT_KIND_KEY: Record<ClientKind, string> = {
  individual: "clients.kindIndividual",
  business: "clients.kindBusiness",
  reseller: "clients.kindReseller",
};

export const CLIENT_SOURCE_KEY: Record<ClientSource, string> = {
  instagram: "clients.sourceInstagram",
  referral: "clients.sourceReferral",
  market: "clients.sourceMarket",
  walk_in: "clients.sourceWalkIn",
  website: "clients.sourceWebsite",
  other: "clients.sourceOther",
};

export const EVENT_KIND_KEY: Record<EventKind, string> = {
  call: "clients.kindCall",
  meeting: "clients.kindMeeting",
  message: "clients.kindMessage",
  sample_sent: "clients.kindSampleSent",
  complaint: "clients.kindComplaint",
  note: "clients.kindNote",
  // Phase 7 renders these; the keys land with the Marketing dictionary.
  filming: "clients.kindNote",
  networking: "clients.kindNote",
  campaign: "clients.kindNote",
};

/** The `transactions` columns the analytics actually needs. */
export type ClientRevenueRow = Pick<
  Transaction,
  "source_id" | "direction" | "amount_minor" | "occurred_on"
>;

/** The `orders` columns the analytics actually needs. */
export type ClientOrderRow = Pick<
  Order,
  "id" | "client_id" | "stage" | "created_at"
>;

const DAY_MS = 86_400_000;

/**
 * Money received per client, in kuruş.
 *
 * The join is transaction → order → client, because a transaction's
 * `source_id` is the ORDER, not the client. An order whose client was deleted
 * (`client_id` is SET NULL) still has revenue — it just cannot be attributed,
 * so it is deliberately dropped here rather than bucketed under a fake id.
 *
 * ⚠️ A REFUND SUBTRACTS. It is stored as a positive magnitude with
 * `direction: 'out'`, exactly as the ledger stores everything, so the sign
 * comes from the direction and nowhere else.
 */
export function revenueByClient(
  orders: ClientOrderRow[],
  revenue: ClientRevenueRow[]
): Map<string, number> {
  const clientByOrder = new Map<string, string>();
  for (const o of orders) {
    if (o.client_id) clientByOrder.set(o.id, o.client_id);
  }

  const out = new Map<string, number>();
  for (const row of revenue) {
    if (!row.source_id) continue;
    const clientId = clientByOrder.get(row.source_id);
    if (!clientId) continue; // Walk-in, or the client was deleted.
    const signed = row.direction === "out" ? -row.amount_minor : row.amount_minor;
    out.set(clientId, (out.get(clientId) ?? 0) + signed);
  }
  return out;
}

export type ClientStats = {
  clientId: string;
  /** Non-cancelled orders. A cancelled enquiry is not something they bought. */
  orderCount: number;
  /** Money received, in kuruş. Refunds already subtracted. */
  lifetimeMinor: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  /** Null when they have never ordered — not 0, which would read as "today". */
  daysSinceLastOrder: number | null;
  /** Null when they have no orders; dividing by zero is not "₺0 average". */
  averageOrderMinor: number | null;
};

export function clientStats(
  clientId: string,
  orders: ClientOrderRow[],
  revenue: Map<string, number>,
  today: string
): ClientStats {
  const mine = orders.filter(
    (o) => o.client_id === clientId && o.stage !== "cancelled"
  );
  const dates = mine.map((o) => o.created_at).sort();
  const lifetimeMinor = revenue.get(clientId) ?? 0;
  const lastOrderAt = dates.length ? dates[dates.length - 1] : null;

  return {
    clientId,
    orderCount: mine.length,
    lifetimeMinor,
    firstOrderAt: dates.length ? dates[0] : null,
    lastOrderAt,
    daysSinceLastOrder: lastOrderAt ? daysBetween(lastOrderAt, today) : null,
    averageOrderMinor: mine.length
      ? Math.round(lifetimeMinor / mine.length)
      : null,
  };
}

/**
 * Whole days between an ISO timestamp/date and a `YYYY-MM-DD` day.
 *
 * ⚠️ `today` is passed IN, never read from the clock here: `react-hooks/purity`
 * is an error in this project, and a figure that re-reads the clock on every
 * render creeps upward as you click around. The server stamps it once with
 * `todayInIstanbul()` — the app's one correct "today", since a UTC clock
 * answers YESTERDAY between 00:00 and 03:00 local.
 */
export function daysBetween(fromIso: string, today: string): number {
  const from = Date.parse(fromIso.slice(0, 10));
  const to = Date.parse(today);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / DAY_MS));
}

/**
 * Share of buying clients who came back for a second order.
 *
 * ⚠️ Returns null when nobody has ordered at all — the same guard as
 * `lostRate()` in `lib/shipping.ts`. A rate computed over zero clients is a
 * meaningless 0%, and 0% rendered on a dashboard reads as "nobody ever
 * returns", which is a claim about the business rather than about the data.
 */
export function repeatRate(orders: ClientOrderRow[]): number | null {
  const counts = orderCountsByClient(orders);
  if (counts.size === 0) return null;
  let repeat = 0;
  for (const n of counts.values()) if (n > 1) repeat++;
  return repeat / counts.size;
}

function orderCountsByClient(orders: ClientOrderRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (!o.client_id || o.stage === "cancelled") continue;
    counts.set(o.client_id, (counts.get(o.client_id) ?? 0) + 1);
  }
  return counts;
}

export type NewVsReturning = {
  newClients: number;
  returningClients: number;
  /** Money received from clients whose only order is their first. */
  newMinor: number;
  /** Money received from clients who ordered more than once. */
  returningMinor: number;
};

/**
 * Splits both the headcount and the money by whether a client came back.
 *
 * The money split is per CLIENT, not per order: a returning client's first
 * order is part of what a returning client is worth. Splitting per order would
 * answer a different question ("what do first orders earn") and the two are
 * easy to confuse on a chart.
 */
export function newVsReturning(
  orders: ClientOrderRow[],
  revenue: Map<string, number>
): NewVsReturning {
  const counts = orderCountsByClient(orders);
  const out: NewVsReturning = {
    newClients: 0,
    returningClients: 0,
    newMinor: 0,
    returningMinor: 0,
  };

  for (const [clientId, n] of counts) {
    const minor = revenue.get(clientId) ?? 0;
    if (n > 1) {
      out.returningClients++;
      out.returningMinor += minor;
    } else {
      out.newClients++;
      out.newMinor += minor;
    }
  }
  return out;
}

export type SourceBucket = {
  /** Null is the UNKNOWN bucket — a real answer, not a missing one. */
  source: ClientSource | null;
  clients: number;
  minor: number;
};

/**
 * Count and money per acquisition channel.
 *
 * ⚠️ The unknown bucket is RETURNED, not filtered out. Dropping it would make
 * the percentages add to 100% of a subset while looking like 100% of the
 * business — the chart would claim Instagram brings half the money when it
 * brings half of the half anyone recorded a source for.
 */
export function bySource(
  clients: Pick<Client, "id" | "source">[],
  revenue: Map<string, number>
): SourceBucket[] {
  const buckets = new Map<string, SourceBucket>();

  for (const c of clients) {
    const key = c.source ?? "__unknown";
    const bucket = buckets.get(key) ?? {
      source: c.source ?? null,
      clients: 0,
      minor: 0,
    };
    bucket.clients++;
    bucket.minor += revenue.get(c.id) ?? 0;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => b.minor - a.minor);
}

export type QuietClient = { client: Client; stats: ClientStats };

/**
 * Clients who used to come back and have gone quiet.
 *
 * ⚠️ `minOrders` defaults to 2, DELIBERATELY. A client who ordered once and
 * never returned is not "at risk" — they are a one-time buyer, which is the
 * normal case and by far the largest group. Including them would bury the
 * handful of genuinely lapsed regulars under everyone who ever bought a
 * keychain, and a list that always has fifty names in it stops being read.
 *
 * Archived clients are excluded: archiving is how you say "this one is done".
 */
export function goneQuiet(
  clients: Client[],
  orders: ClientOrderRow[],
  revenue: Map<string, number>,
  today: string,
  opts: { minOrders?: number; days?: number } = {}
): QuietClient[] {
  const minOrders = opts.minOrders ?? 2;
  const days = opts.days ?? 90;

  return clients
    .filter((c) => !c.archived_at)
    .map((client) => ({
      client,
      stats: clientStats(client.id, orders, revenue, today),
    }))
    .filter(
      ({ stats }) =>
        stats.orderCount >= minOrders &&
        stats.daysSinceLastOrder != null &&
        stats.daysSinceLastOrder >= days
    )
    .sort(
      (a, b) => (b.stats.daysSinceLastOrder ?? 0) - (a.stats.daysSinceLastOrder ?? 0)
    );
}

export type ClientPnlLine = {
  product_id: string | null;
  quantity: number;
};

export type ClientPnl = {
  /** Money that ARRIVED — passed in, from `transactions`. */
  revenueMinor: number;
  /** What it cost to MAKE what this client ordered, at today's prices. */
  costMinor: number;
  /** revenue − cost. */
  marginMinor: number;
  /** ⚠️ Order-line quantities that couldn't be costed (product deleted, or
   *  never costed). Reported, never folded into cost as 0 — same honesty as the
   *  per-collection P&L, so the margin is never flattered. */
  uncostedUnits: number;
};

/**
 * Per-client P&L.
 *
 * ⚠️ REVENUE IS `revenueMinor` (money received, from `transactions`) — NEVER the
 * sum of `orders.total_minor`. COST is computed at READ TIME from the ordered
 * products (`productCost`), exactly like the per-collection P&L, so re-pricing a
 * filament re-costs history correctly rather than reading a stale stored number.
 * A line whose product was deleted or was never costed is COUNTED in
 * `uncostedUnits` and left out of cost, so the margin never quietly overstates.
 */
export function clientPnl(
  revenueMinor: number,
  lines: ClientPnlLine[],
  products: Product[],
  supplies: Supply[],
  machineHourRateMinor: number,
  laborHourRateMinor: number
): ClientPnl {
  const byId = new Map(products.map((p) => [p.id, p]));
  let costMinor = 0;
  let uncostedUnits = 0;

  for (const line of lines) {
    const qty = Math.max(1, line.quantity);
    const product = line.product_id ? byId.get(line.product_id) : undefined;
    const cost = product
      ? productCost(product, supplies, machineHourRateMinor, laborHourRateMinor)
      : null;
    if (!cost) uncostedUnits += qty;
    else costMinor += cost.totalMinor * qty;
  }

  return {
    revenueMinor,
    costMinor,
    marginMinor: revenueMinor - costMinor,
    uncostedUnits,
  };
}

/** Top clients by MONEY RECEIVED. Never by `orders.total_minor`. */
export function topClients(
  clients: Client[],
  orders: ClientOrderRow[],
  revenue: Map<string, number>,
  today: string,
  limit = 8
): QuietClient[] {
  return clients
    .map((client) => ({
      client,
      stats: clientStats(client.id, orders, revenue, today),
    }))
    .filter(({ stats }) => stats.lifetimeMinor > 0)
    .sort((a, b) => b.stats.lifetimeMinor - a.stats.lifetimeMinor)
    .slice(0, limit);
}
