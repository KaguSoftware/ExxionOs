import { Check } from "lucide-react";

import { Activity, type ActivityItem } from "@/components/dashboard/activity";
import { MonthSummary } from "@/components/dashboard/month-summary";
import { NeedsYou } from "@/components/dashboard/needs-you";
import { Reminders } from "@/components/dashboard/reminders";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { PageHeader } from "@/components/ui/panel";
import { countOrThrow, rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { goneQuiet, type ClientOrderRow } from "@/lib/clients";
import { isLowStock } from "@/lib/equipment";
import { groupCosts, overBudgetCampaigns } from "@/lib/marketing";
import { totals } from "@/lib/finance-series";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type {
  Campaign,
  CampaignCost,
  Client,
  Direction,
  Event,
  Order,
  OrderPayment,
  OrderStage,
  ProductStockMovement,
  Reminder,
  Supply,
  Transaction,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * ⚠️ An embedded relation is typed as an ARRAY by the Supabase client even
 * when the FK guarantees at most one row. Declaring it as an object compiles
 * against a lie and then reads `undefined` at runtime — normalise instead.
 * (Same shape as the `ProductRow` note in shipping/orders/new.)
 */
type StageEventRow = {
  id: string;
  order_id: string;
  stage: OrderStage;
  entered_at: string;
  orders: { code: string | null }[] | { code: string | null } | null;
};

function orderCode(row: StageEventRow): string | null {
  const o = row.orders;
  if (!o) return null;
  return Array.isArray(o) ? (o[0]?.code ?? null) : o.code;
}

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE. Every query this page needs goes in this single
   * `Promise.all`. A round-trip costs ~305ms; a query ADDED to an existing
   * wave costs ~3ms. When phases 2-7 add their counts here, they go INSIDE
   * this array — never in an `await` above it. Do not count queries; count
   * waves.
   */
  const today = todayInIstanbul();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    reminders,
    monthRows,
    openIssues,
    machinesDown,
    supplyRows,
    activeOrders,
    orderPayments,
    quietCandidates,
    clientOrders,
    liveCampaigns,
    campaignCosts,
    stageEvents,
    clientEvents,
    stockMovements,
  ] = await Promise.all([
    rowsOrThrow<Reminder>(
      "dashboard.reminders",
      supabase
        .from("reminders")
        .select("*")
        .eq("owner_id", ctx.userId)
        .is("done_at", null)
        // Dated reminders first (nulls last), soonest first — a note to self
        // with no date shouldn't outrank something actually due.
        .order("due_on", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50)
    ),
    // Phase 2: this month's money. Added INSIDE the existing wave — ~3ms, not
    // a second round-trip. Only the two columns the totals need.
    rowsOrThrow<{ direction: Direction; amount_minor: number }>(
      "dashboard.month",
      supabase
        .from("transactions")
        .select("direction, amount_minor")
        .gte("occurred_on", monthStart)
        .lte("occurred_on", today)
    ),
    // Phase 3: unsolved issues. Head-only count — the dashboard needs the
    // NUMBER, not the rows, and fetching rows to call `.length` on them would
    // pull data across the wire for nothing.
    countOrThrow(
      "dashboard.openIssues",
      supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null)
    ),
    // Phase 4: machines that want a human, and supplies about to run out.
    // Both INSIDE the existing wave.
    countOrThrow(
      "dashboard.machinesDown",
      supabase
        .from("machines")
        .select("*", { count: "exact", head: true })
        .in("status", ["broken", "needs_attention"])
    ),
    // Low stock can't be a SQL count: it compares two columns, and PostgREST
    // has no column-to-column filter. Fetch the two numbers and compare in JS —
    // the table is small and this stays inside the same wave either way.
    rowsOrThrow<Pick<Supply, "quantity" | "low_threshold">>(
      "dashboard.supplies",
      supabase
        .from("supplies")
        .select("quantity, low_threshold")
        .is("archived_at", null)
        .not("low_threshold", "is", null)
    ),
    /**
     * Phase 5: orders that need a human. Both INSIDE the existing wave.
     *
     * ⚠️ "Delivered but unpaid" cannot be a SQL count — it compares the order's
     * total against the sum of its payments, which PostgREST can't express.
     * Fetch the few columns and compare in JS, exactly as low stock does above.
     * Cancelled orders are excluded: they are an exit, not a debt.
     */
    rowsOrThrow<Pick<Order, "id" | "stage" | "promised_on" | "total_minor">>(
      "dashboard.orders",
      supabase
        .from("orders")
        .select("id, stage, promised_on, total_minor")
        .neq("stage", "cancelled")
    ),
    rowsOrThrow<Pick<OrderPayment, "order_id" | "amount_minor" | "kind">>(
      "dashboard.orderPayments",
      supabase.from("order_payments").select("order_id, amount_minor, kind")
    ),
    /**
     * Phase 6: regulars who have gone quiet. INSIDE the existing wave.
     *
     * Also cannot be a SQL count — it needs each client's order count AND how
     * long since their last one, then a threshold on both. Fetch the rows and
     * fold in JS, exactly as low stock and unpaid orders do above.
     *
     * ⚠️ `dashboard.orders` above excludes cancelled orders, so it can't answer
     * "when did they last order" on its own; these are the client-linked
     * orders including their dates.
     */
    rowsOrThrow<Client>(
      "dashboard.clients",
      supabase.from("clients").select("*").is("archived_at", null)
    ),
    rowsOrThrow<ClientOrderRow>(
      "dashboard.clientOrders",
      supabase.from("orders").select("id, client_id, stage, created_at").limit(2000)
    ),
    /**
     * Phase 7: campaigns that have run past their budget. INSIDE the wave.
     *
     * ⚠️ Not a SQL comparison — actual spend is the SUM of the campaign's cost
     * rows, and "over budget" compares that sum against a column on a different
     * table. Fetch both and fold in JS, exactly as low stock, unpaid orders and
     * gone-quiet clients do above. Only live campaigns can be over budget: a
     * finished one is history, not a thing to act on.
     */
    rowsOrThrow<Campaign>(
      "dashboard.campaigns",
      supabase
        .from("campaigns")
        .select("*")
        .is("archived_at", null)
        .in("status", ["planned", "running"])
    ),
    rowsOrThrow<CampaignCost>(
      "dashboard.campaignCosts",
      supabase.from("campaign_costs").select("*")
    ),
    /**
     * The activity feed's two sources. Both are append-only, so "recent" is a
     * plain `order by … desc limit`, not a computed diff.
     *
     * ⚠️ INSIDE this wave, not awaited above it — see the note at the top.
     * `orders(code)` is an embedded relation, which Supabase types as an ARRAY
     * even though the FK guarantees one row; it is normalised below rather
     * than declared as an object, which would compile against a lie.
     */
    rowsOrThrow<StageEventRow>(
      "dashboard.stageEvents",
      supabase
        .from("order_stage_events")
        .select("id, order_id, stage, entered_at, orders(code)")
        .order("entered_at", { ascending: false })
        .limit(12)
    ),
    rowsOrThrow<Event>(
      "dashboard.events",
      supabase
        .from("events")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12)
    ),
    /**
     * Phase 3: products with nothing left on the shelf.
     *
     * ⚠️ CANNOT BE A SQL COUNT, and cannot be limited. On-hand is
     * `sum(delta)` per product, so answering "how many are at zero" needs
     * every row — a `limit` here would produce a partial sum, i.e. a wrong
     * number that still looks like an answer. Same reason low stock above is
     * compared in JS. Inside the wave either way.
     */
    rowsOrThrow<Pick<ProductStockMovement, "product_id" | "delta">>(
      "dashboard.stockMovements",
      supabase.from("product_stock_movements").select("product_id, delta")
    ),
  ]);

  const dueCount = reminders.filter((r) => r.due_on && r.due_on <= today).length;
  const monthTotals = totals(monthRows as Transaction[]);
  const lowSupplies = supplyRows.filter(isLowStock).length;

  /**
   * Products that have run OUT — not products that were never made.
   *
   * ⚠️ COUNTED FROM THE LEDGER ONLY, deliberately. A design with no movements
   * at all has never been printed, so it is not "out of stock"; it is an idea.
   * Counting those would put every unprinted design in the strip on day one
   * and train the reader to ignore it. A product appears here only once it has
   * moved and come back to zero.
   */
  const stockByProduct = new Map<string, number>();
  for (const m of stockMovements) {
    stockByProduct.set(
      m.product_id,
      (stockByProduct.get(m.product_id) ?? 0) + Number(m.delta)
    );
  }
  const productsOutOfStock = [...stockByProduct.values()].filter(
    (units) => units <= 0
  ).length;

  // Fold payments per order once, then answer both order questions from it.
  const paidByOrder = new Map<string, number>();
  for (const p of orderPayments) {
    const signed = p.kind === "refund" ? -p.amount_minor : p.amount_minor;
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + signed);
  }

  const ordersOverdue = activeOrders.filter(
    (o) =>
      o.stage !== "delivered" && !!o.promised_on && o.promised_on < today
  ).length;

  const ordersUnpaid = activeOrders.filter(
    (o) =>
      o.stage === "delivered" &&
      o.total_minor > (paidByOrder.get(o.id) ?? 0)
  ).length;

  /**
   * Regulars — two orders or more — with nothing for 90 days.
   *
   * The empty revenue map is deliberate: `goneQuiet` filters on order COUNT and
   * RECENCY, never on money, so the dashboard doesn't pay for the transactions
   * query just to compute a lifetime value it never shows.
   */
  const clientsQuiet = goneQuiet(
    quietCandidates,
    clientOrders,
    new Map(),
    today
  ).length;

  const campaignsOverBudget = overBudgetCampaigns(
    liveCampaigns,
    groupCosts(campaignCosts)
  ).length;

  /**
   * Merge the two activity sources into one list. Fetched 12 + 12 and cut to
   * 10 here rather than asking the database for a union: two ordered reads on
   * indexed columns are cheaper than a view, and the cut has to happen after
   * the merge anyway.
   */
  const activity: ActivityItem[] = [
    ...stageEvents.map(
      (row): ActivityItem => ({
        type: "order",
        id: row.id,
        orderId: row.order_id,
        code: orderCode(row),
        stage: row.stage,
        at: row.entered_at,
      })
    ),
    ...clientEvents.map(
      (row): ActivityItem => ({
        type: "event",
        id: row.id,
        kind: row.kind,
        title: row.title,
        clientId: row.client_id,
        at: row.occurred_on,
      })
    ),
  ]
    .sort((a, b) => b.at.slice(0, 10).localeCompare(a.at.slice(0, 10)))
    .slice(0, 10);

  /** Mirrors NeedsYou's own emptiness test — see the calm state below. */
  const needsAttention =
    dueCount +
      openIssues +
      machinesDown +
      lowSupplies +
      ordersOverdue +
      ordersUnpaid +
      clientsQuiet +
      campaignsOverBudget +
      productsOutOfStock >
    0;

  const greeting = greetingKey();
  const firstName = ctx.profile.full_name.split(/\s+/)[0] || "";

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <LiveRefresh
        tables={[
          "reminders",
          "transactions",
          "issues",
          "machines",
          "supplies",
          "orders",
          "order_payments",
          "clients",
          "campaigns",
          "campaign_costs",
          "order_stage_events",
          "events",
          "product_stock_movements",
        ]}
      />

      <PageHeader title={t(greeting, { name: firstName })} />

      {/* ⚠️ Renders NOTHING when every count is zero. A permanent strip reading
          all zeros is furniture, not an answer to "what needs my attention?"
          The calm state below takes over instead — the ABSENCE of the strip is
          the answer, but the page still has to say so out loud. */}
      {needsAttention ? (
        <NeedsYou
          dueCount={dueCount}
          openIssues={openIssues}
          machinesDown={machinesDown}
          lowSupplies={lowSupplies}
          ordersOverdue={ordersOverdue}
          ordersUnpaid={ordersUnpaid}
          clientsQuiet={clientsQuiet}
          campaignsOverBudget={campaignsOverBudget}
          productsOutOfStock={productsOutOfStock}
        />
      ) : (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-muted">
          <Check aria-hidden className="size-4 shrink-0 text-success" />
          <span className="text-ink">{t("dashboard.allClear")}</span>
          <span className="hidden text-xs text-faint sm:inline">
            {t("dashboard.allClearHint")}
          </span>
        </p>
      )}

      {/* This month's money, linking into Finance. ⚠️ The link uses the REAL
          filter params from `use-finance-filters.ts` — a made-up param would
          silently land on an unfiltered view. */}
      <MonthSummary totals={monthTotals} monthStart={monthStart} today={today} />

      {/* ⚠️ Reminders was pinned into a 20rem rail and its composer — text input
          + date picker + button — had nowhere to go; the input collapsed to a
          few characters wide (Parsa reported it, 2026-07-21). It now takes a
          real share of the row, and only on `xl` where there is width to give.
          Below that it is full-width and the composer breathes. */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
        {/* `scroll-mt` so the NeedsYou "#reminders" anchor doesn't land the
            panel flush against the top edge of the viewport. */}
        <div id="reminders" className="scroll-mt-4 xl:order-2 xl:col-start-2 xl:row-start-1">
          <Reminders initial={reminders} />
        </div>

        {/* ⚠️ This slot held a dashed "coming in a later phase" box until all
            seven phases had shipped — a panel promising something that already
            existed, on the most valuable screen in the app. */}
        <Activity items={activity} className="xl:order-1" />
      </div>
    </div>
  );
}

function greetingKey() {
  // Istanbul hour, not the server's — the server is UTC and would greet
  // "good morning" at 2am local.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return "dashboard.greetingMorning" as const;
  if (hour < 18) return "dashboard.greetingAfternoon" as const;
  return "dashboard.greetingEvening" as const;
}
