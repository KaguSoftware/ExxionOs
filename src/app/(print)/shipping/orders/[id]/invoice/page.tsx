import { notFound } from "next/navigation";

import { Invoice } from "@/components/print/invoice";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  Client,
  Order,
  OrderLine,
  OrderPayment,
} from "@/lib/types";

/** A printable quote or invoice for one order. `?kind=quote|invoice`. */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params;
  const { kind } = await searchParams;
  const isQuote = kind === "quote";
  const supabase = await createClient();

  // The order row first — the client read depends on order.client_id. Everything
  // that only needs the id from the URL is fetched alongside it in one wave.
  const [orderResult, lines, payments, settingsResult] = await Promise.all([
    selectOrThrow<Order>(
      "invoice.order",
      supabase.from("orders").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<OrderLine>(
      "invoice.lines",
      supabase.from("order_lines").select("*").eq("order_id", id).order("sort_order")
    ),
    rowsOrThrow<OrderPayment>(
      "invoice.payments",
      supabase
        .from("order_payments")
        .select("*")
        .eq("order_id", id)
        .order("paid_on", { ascending: true })
    ),
    selectOrThrow<AppSettings>(
      "invoice.settings",
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    ),
  ]);

  const order = orderResult.data;
  if (!order) notFound();

  let client: Client | null = null;
  if (order.client_id) {
    const clientResult = await selectOrThrow<Client>(
      "invoice.client",
      supabase.from("clients").select("*").eq("id", order.client_id).maybeSingle()
    );
    client = clientResult.data;
  }

  return (
    <Invoice
      order={order}
      lines={lines}
      payments={payments}
      client={client}
      settings={settingsResult.data}
      isQuote={isQuote}
    />
  );
}
