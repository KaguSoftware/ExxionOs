import { Suspense } from "react";

import { LiveRefresh } from "@/components/shell/live-refresh";
import { ShippingPanels } from "@/components/shipping/panels";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Order,
  OrderLine,
  OrderPayment,
  OrderStageEvent,
  Transaction,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Shipping — ONE page, three tabs, switched in pure client state.
 *
 * ⚠️ ONE WAVE, including the data for tabs nobody has clicked yet. ~305ms per
 * round-trip against ~3ms for a query added to an existing `Promise.all`.
 */
export default async function ShippingPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [orders, clients, lines, payments, stageEvents, revenue] =
    await Promise.all([
      rowsOrThrow<Order>(
        "shipping.orders",
        supabase
          .from("orders")
          .select("*")
          .order("promised_on", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      rowsOrThrow<Client>(
        "shipping.clients",
        supabase.from("clients").select("*").is("archived_at", null).order("name")
      ),
      rowsOrThrow<OrderLine>(
        "shipping.lines",
        supabase.from("order_lines").select("*").order("sort_order")
      ),
      rowsOrThrow<OrderPayment>(
        "shipping.payments",
        supabase.from("order_payments").select("*").order("paid_on")
      ),
      // Powers cycle-time on the Insights tab. In the same wave — ~3ms.
      rowsOrThrow<OrderStageEvent>(
        "shipping.stageEvents",
        supabase
          .from("order_stage_events")
          .select("*")
          .order("entered_at")
          .limit(4000)
      ),
      /**
       * ⚠️ REVENUE COMES FROM FINANCE, never from summing `orders.total_minor`.
       * The total is what was AGREED; a quoted order that was never paid has a
       * total and no money. The transaction is the single source of truth —
       * exactly as machine spend is (see `(app)/equipment/page.tsx`).
       */
      rowsOrThrow<Pick<Transaction, "occurred_on" | "direction" | "amount_minor">>(
        "shipping.revenue",
        supabase
          .from("transactions")
          .select("occurred_on, direction, amount_minor")
          .eq("source_type", "order")
      ),
    ]);

  return (
    <>
      <LiveRefresh
        tables={["orders", "order_lines", "order_payments", "order_stage_events"]}
      />
      <Suspense>
        <ShippingPanels
          orders={orders}
          clients={clients}
          lines={lines}
          payments={payments}
          stageEvents={stageEvents}
          revenue={revenue}
          /**
           * ⚠️ The DATE, not a millisecond clock. Cycle time is reported in
           * whole days, so day resolution is all it needs — and a date keeps
           * the figure stable across re-renders instead of creeping upward,
           * which is what `react-hooks/purity` (an error here) guards against.
           * `todayInIstanbul()` is also the project's one correct "today":
           * a UTC clock answers YESTERDAY between 00:00 and 03:00 local.
           */
          today={todayInIstanbul()}
        />
      </Suspense>
    </>
  );
}
