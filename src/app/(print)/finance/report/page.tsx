import {
  MonthlyReport,
  type ReportOrder,
  type ReportOrderLine,
} from "@/components/print/monthly-report";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  Category,
  Client,
  Product,
  Supply,
  Transaction,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * A printable monthly finance report. `?month=YYYY-MM`, defaulting to the
 * current Istanbul month.
 *
 * ⚠️ THE MONEY RULE: income/expense/net come from `transactions`, never from
 * summing `orders.total_minor`. See `MonthlyReport`.
 */
export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: rawMonth } = await searchParams;
  // Loose YYYY-MM validation; fall back to the current Istanbul month if the
  // param is missing or malformed (a bad ?month must not 500 the report).
  const month =
    rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)
      ? rawMonth
      : todayInIstanbul().slice(0, 7);

  const monthStart = `${month}-01`;
  const nextMonthStart = `${nextMonth(month)}-01`;
  const prevMonthStart = `${prevMonth(month)}-01`;

  const supabase = await createClient();

  const [
    monthTransactions,
    prevTransactions,
    categories,
    settingsResult,
    products,
    supplies,
    orders,
    lines,
    clients,
  ] = await Promise.all([
    rowsOrThrow<Transaction>(
      "report.transactions",
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", monthStart)
        .lt("occurred_on", nextMonthStart)
    ),
    rowsOrThrow<Transaction>(
      "report.prevTransactions",
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", prevMonthStart)
        .lt("occurred_on", monthStart)
    ),
    rowsOrThrow<Category>(
      "report.categories",
      supabase.from("categories").select("*").order("sort_order")
    ),
    selectOrThrow<AppSettings>(
      "report.settings",
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    ),
    rowsOrThrow<Product>(
      "report.products",
      supabase.from("products").select("*")
    ),
    rowsOrThrow<Supply>("report.supplies", supabase.from("supplies").select("*")),
    // "Sold this month" = order lines of orders CREATED within the month. A
    // concrete, stable definition (documented in the component). We fetch the
    // in-month orders for both the product table and top-client attribution.
    rowsOrThrow<ReportOrder>(
      "report.orders",
      supabase
        .from("orders")
        .select("id, client_id, stage, created_at")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart)
    ),
    rowsOrThrow<ReportOrderLine & { order_id: string }>(
      "report.lines",
      supabase
        .from("order_lines")
        .select("order_id, product_id, quantity, unit_price_minor, orders!inner(created_at)")
        .gte("orders.created_at", monthStart)
        .lt("orders.created_at", nextMonthStart)
    ),
    rowsOrThrow<Client>("report.clients", supabase.from("clients").select("*")),
  ]);

  return (
    <MonthlyReport
      monthStart={monthStart}
      monthTransactions={monthTransactions}
      prevTransactions={prevTransactions}
      categories={categories}
      settings={settingsResult.data}
      products={products}
      supplies={supplies}
      orders={orders}
      lines={lines}
      clients={clients}
    />
  );
}

/**
 * Previous YYYY-MM by string/number math on the year-month — NEVER via
 * Date.now/new Date(), which would drag a time zone into a pure calendar step.
 */
function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${`${m - 1}`.padStart(2, "0")}`;
}

/** Next YYYY-MM, same string/number math. */
function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${`${m + 1}`.padStart(2, "0")}`;
}
