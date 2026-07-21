import { MonthSummary } from "@/components/dashboard/month-summary";
import { NeedsYou } from "@/components/dashboard/needs-you";
import { Reminders } from "@/components/dashboard/reminders";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { PageHeader } from "@/components/ui/panel";
import { countOrThrow, rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { isLowStock } from "@/lib/equipment";
import { totals } from "@/lib/finance-series";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type {
  Direction,
  Order,
  OrderPayment,
  Reminder,
  Supply,
  Transaction,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

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
  ]);

  const dueCount = reminders.filter((r) => r.due_on && r.due_on <= today).length;
  const monthTotals = totals(monthRows as Transaction[]);
  const lowSupplies = supplyRows.filter(isLowStock).length;

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
        ]}
      />

      <PageHeader title={t(greeting, { name: firstName })} />

      {/* ⚠️ Renders NOTHING when every count is zero. A permanent strip reading
          all zeros is furniture, not an answer to "what needs my attention?" */}
      <NeedsYou
        dueCount={dueCount}
        openIssues={openIssues}
        machinesDown={machinesDown}
        lowSupplies={lowSupplies}
        ordersOverdue={ordersOverdue}
        ordersUnpaid={ordersUnpaid}
      />

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
        <Reminders
          initial={reminders}
          className="xl:order-2 xl:col-start-2 xl:row-start-1"
        />

        <section className="rounded-xl border border-dashed border-line p-8 text-center xl:order-1">
          <p className="text-sm text-muted">{t("dashboard.recentActivity")}</p>
          <p className="mt-1 text-xs text-faint">{t("dashboard.comingInPhase")}</p>
        </section>
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
