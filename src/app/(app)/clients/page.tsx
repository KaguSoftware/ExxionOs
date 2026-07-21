import { Suspense } from "react";

import { ClientPanels, type ClientRevenueRow } from "@/components/clients/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import type { ClientOrderRow } from "@/lib/clients";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Clients — ONE page, two tabs, switched in pure client state.
 *
 * ⚠️ ONE WAVE, including the data for the tab nobody has clicked yet. A
 * round-trip is ~305ms; a query added to this `Promise.all` costs ~3ms. A new
 * stat goes INSIDE this array, never in an `await` above it.
 */
export default async function ClientsPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [clients, orders, revenue] = await Promise.all([
    rowsOrThrow<Client>(
      "clients.list",
      // Archived clients ARE fetched — the directory has a "show archived"
      // toggle, and hiding them server-side would make it a dead control.
      supabase.from("clients").select("*").order("name")
    ),
    /**
     * Only the columns the analytics needs. Orders themselves live in Shipping;
     * here they are the JOIN between a client and the money their payments
     * produced.
     */
    rowsOrThrow<ClientOrderRow>(
      "clients.orders",
      supabase
        .from("orders")
        .select("id, client_id, stage, created_at")
        .limit(2000)
    ),
    /**
     * ⚠️ THE MONEY. Read from `transactions`, never by summing
     * `orders.total_minor` — the total is the AGREED PRICE, and a quoted order
     * that was never paid would otherwise crown a client who has paid nothing.
     * `source_id` is the ORDER; `revenueByClient()` joins it through to the
     * client. Exactly how Shipping reads revenue and Equipment reads spend.
     */
    rowsOrThrow<ClientRevenueRow>(
      "clients.revenue",
      supabase
        .from("transactions")
        .select("source_id, direction, amount_minor, occurred_on")
        .eq("source_type", "order")
    ),
  ]);

  return (
    <>
      <LiveRefresh tables={["clients", "events", "orders"]} />
      <Suspense>
        <ClientPanels
          clients={clients}
          orders={orders}
          revenue={revenue}
          /**
           * ⚠️ The DATE, stamped once on the server. "Gone quiet" counts days
           * since the last order, and `react-hooks/purity` is an error here so
           * that figure can never be re-read from the clock mid-render.
           * `todayInIstanbul()` is the app's one correct today — a UTC clock
           * answers YESTERDAY between 00:00 and 03:00 local.
           */
          today={todayInIstanbul()}
        />
      </Suspense>
    </>
  );
}
