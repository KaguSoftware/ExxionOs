import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ClientDetail } from "@/components/clients/client-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import {
  clientPnl,
  revenueByClient,
  type ClientRevenueRow,
} from "@/lib/clients";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Event,
  Order,
  OrderLine,
  Product,
  Supply,
  Vocabulary,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

export default async function ClientPage({
  params,
}: {
  // Next 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE. Nothing here depends on the client ROW's contents — only on
   * the id from the URL — so fetching it first would add ~305ms to buy nothing.
   */
  const [
    clientResult,
    orders,
    events,
    revenue,
    tagVocabulary,
    lineRows,
    products,
    supplies,
    settings,
  ] = await Promise.all([
      selectOrThrow<Client>(
        "client.row",
        supabase.from("clients").select("*").eq("id", id).maybeSingle()
      ),
      rowsOrThrow<Order>(
        "client.orders",
        supabase
          .from("orders")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false })
      ),
      rowsOrThrow<Event>(
        "client.events",
        supabase
          .from("events")
          .select("*")
          .eq("client_id", id)
          .order("occurred_on", { ascending: false })
          .limit(200)
      ),
      /**
       * ⚠️ THE MONEY, from `transactions` — never from `orders.total_minor`.
       * Fetched for this client's orders only; `revenueByClient()` does the
       * transaction → order → client join and applies the refund sign.
       */
      rowsOrThrow<ClientRevenueRow>(
        "client.revenue",
        supabase
          .from("transactions")
          .select("source_id, direction, amount_minor, occurred_on")
          .eq("source_type", "order")
      ),
      // ⚠️ ALL tags, not just live ones — this client may carry a word that
      // was archived since, and the form keeps it visible so saving can't
      // silently drop it.
      rowsOrThrow<Vocabulary>(
        "client.tags",
        supabase
          .from("vocabularies")
          .select("*")
          .eq("kind", "client_tag")
          .order("sort_order")
      ),
      /**
       * This client's order lines — for per-client P&L. Filtered by an INNER
       * embed on the parent order's client_id, so it stays one query in the
       * wave rather than needing the order ids first. Only the columns the
       * cost/revenue fold needs.
       */
      rowsOrThrow<
        Pick<OrderLine, "product_id" | "quantity" | "unit_price_minor">
      >(
        "client.lines",
        supabase
          .from("order_lines")
          .select("product_id, quantity, unit_price_minor, orders!inner(client_id)")
          .eq("orders.client_id", id)
      ),
      // Products + supplies + machine rate cost those lines, at read time.
      rowsOrThrow<Product>(
        "client.products",
        supabase.from("products").select("*")
      ),
      rowsOrThrow<Supply>(
        "client.supplies",
        supabase.from("supplies").select("*")
      ),
      selectOrThrow<{ machine_hour_rate_minor: number; labor_hour_rate_minor: number }>(
        "client.settings",
        supabase
          .from("app_settings")
          .select("machine_hour_rate_minor, labor_hour_rate_minor")
          .eq("id", 1)
          .maybeSingle()
      ),
    ]);

  const client = clientResult.data;
  if (!client) notFound();

  const orderRows = orders.map((o) => ({
    id: o.id,
    client_id: o.client_id,
    stage: o.stage,
    created_at: o.created_at,
  }));

  const revenueMinor = revenueByClient(orderRows, revenue).get(id) ?? 0;

  const pnl = clientPnl(
    revenueMinor,
    lineRows.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
    products,
    supplies,
    settings.data?.machine_hour_rate_minor ?? 0,
    settings.data?.labor_hour_rate_minor ?? 0
  );

  return (
    <>
      <LiveRefresh tables={["clients", "events", "orders"]} />
      <Suspense>
        <ClientDetail
          client={client}
          orders={orders}
          revenue={revenueMinor}
          pnl={pnl}
          events={events}
          today={todayInIstanbul()}
          tagVocabulary={tagVocabulary}
        />
      </Suspense>
    </>
  );
}
