import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderDetail } from "@/components/shipping/order-detail";
import type { ProductOption } from "@/components/shipping/order-form";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Order,
  OrderLine,
  OrderPayment,
  OrderStageEvent,
} from "@/lib/types";

/**
 * ⚠️ An embedded relation is typed as an ARRAY by the Supabase client even
 * when the FK guarantees at most one row. See the same note in `../new/page.tsx`.
 */
type ProductRow = {
  id: string;
  name: string;
  price_minor: number | null;
  collections: { name: string }[] | { name: string } | null;
};

function collectionName(row: ProductRow): string {
  const c = row.collections;
  if (!c) return "";
  return Array.isArray(c) ? (c[0]?.name ?? "") : c.name;
}

export default async function OrderPage({
  params,
}: {
  // Next 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE. The order row is fetched alongside everything else rather
   * than first — nothing here depends on its contents, only on the id from the
   * URL, so making it sequential would add ~305ms to buy nothing.
   */
  const [orderResult, lines, payments, events, clients, products] =
    await Promise.all([
      selectOrThrow<Order>(
        "order.row",
        supabase.from("orders").select("*").eq("id", id).maybeSingle()
      ),
      rowsOrThrow<OrderLine>(
        "order.lines",
        supabase.from("order_lines").select("*").eq("order_id", id).order("sort_order")
      ),
      rowsOrThrow<OrderPayment>(
        "order.payments",
        supabase
          .from("order_payments")
          .select("*")
          .eq("order_id", id)
          .order("paid_on", { ascending: false })
      ),
      rowsOrThrow<OrderStageEvent>(
        "order.events",
        supabase
          .from("order_stage_events")
          .select("*")
          .eq("order_id", id)
          .order("entered_at", { ascending: false })
      ),
      rowsOrThrow<Client>(
        "order.clients",
        supabase.from("clients").select("*").is("archived_at", null).order("name")
      ),
      rowsOrThrow<ProductRow>(
        "order.products",
        supabase
          .from("products")
          .select("id, name, price_minor, collections(name)")
          .order("name")
      ),
    ]);

  const order = orderResult.data;
  if (!order) notFound();

  const options: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    collectionName: collectionName(p),
    priceMinor: p.price_minor,
  }));

  return (
    <>
      <LiveRefresh
        tables={["orders", "order_lines", "order_payments", "order_stage_events"]}
      />
      <Suspense>
        <OrderDetail
          order={order}
          lines={lines}
          payments={payments}
          events={events}
          clients={clients}
          products={options}
        />
      </Suspense>
    </>
  );
}
