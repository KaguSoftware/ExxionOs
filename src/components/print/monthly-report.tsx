"use client";

import { PrintShell } from "@/components/print/print-shell";
import {
  categoryBreakdown,
  totals,
  type CategorySlice,
} from "@/lib/finance-series";
import {
  costingRates,
  productCost,
  productMargin,
  productMarginPct,
} from "@/lib/costing";
import { revenueByClient, type ClientOrderRow } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import type {
  AppSettings,
  Category,
  Client,
  OrderLine,
  Product,
  Supply,
  Transaction,
} from "@/lib/types";
import { formatDate, formatMinor } from "@/lib/utils";

/** An order line paired with the order it belongs to (for client attribution). */
export type ReportOrderLine = Pick<
  OrderLine,
  "product_id" | "quantity" | "unit_price_minor"
>;

/**
 * The minimal order shape the report needs (in-month orders). It matches
 * `ClientOrderRow` so it can feed `revenueByClient` directly.
 */
export type ReportOrder = ClientOrderRow;

type ProductRow = {
  productId: string;
  name: string;
  units: number;
  revenueMinor: number;
  marginMinor: number;
  marginPct: number | null;
};

/**
 * A printable monthly finance report. Committed to a LIGHT look (black on
 * white), like the invoice — it's a document meant for paper/PDF, so it uses
 * literal hex, not app theme tokens.
 *
 * ⚠️ THE MONEY RULE: income/expense/net all come from `transactions`
 * (direction in/out), NEVER from summing `orders.total_minor`. Product
 * "revenue" here is the line price a product SOLD FOR, used only for the
 * per-product margin table — it is not the report's income figure.
 */
export function MonthlyReport({
  monthStart,
  monthTransactions,
  prevTransactions,
  categories,
  settings,
  products,
  supplies,
  orders,
  lines,
  clients,
}: {
  monthStart: string;
  monthTransactions: Transaction[];
  prevTransactions: Transaction[];
  categories: Category[];
  settings: AppSettings | null;
  products: Product[];
  supplies: Supply[];
  orders: ReportOrder[];
  lines: ReportOrderLine[];
  clients: Client[];
}) {
  const { t, locale } = useI18n();

  const monthTotals = totals(monthTransactions);
  const prevTotals = totals(prevTransactions);

  // vs-last-month: signed absolute delta always; percentage only when the
  // previous net is non-zero (a % change from 0 is undefined, not ∞/100%).
  const netDelta = monthTotals.netMinor - prevTotals.netMinor;
  const netDeltaPct =
    prevTotals.netMinor !== 0
      ? Math.round((netDelta / Math.abs(prevTotals.netMinor)) * 100)
      : null;

  const catSlices = categoryBreakdown(
    monthTransactions,
    categories,
    t("report.other")
  );

  const { machineHourRateMinor, laborHourRateMinor } = costingRates(settings);

  // --- Top products by margin ------------------------------------------------
  // "Sold this month" is DEFINED as: order lines belonging to orders CREATED in
  // the month. This is an approximation (a line reaches revenue when paid, which
  // may lag creation), but it is concrete and stable — see the page's fetch.
  const productById = new Map(products.map((p) => [p.id, p]));
  const byProduct = new Map<string, ProductRow>();
  let uncostedUnits = 0;

  for (const line of lines) {
    const qty = Math.max(1, line.quantity);
    const product = line.product_id ? productById.get(line.product_id) : undefined;
    const cost = product
      ? productCost(product, supplies, machineHourRateMinor, laborHourRateMinor)
      : null;
    // A deleted or uncosted product cannot be ranked by margin — count it and
    // move on, so the ranking never quietly overstates (honest, like clientPnl).
    if (!product || !cost) {
      uncostedUnits += qty;
      continue;
    }
    const marginUnit = productMargin(product, cost);
    if (marginUnit == null) {
      uncostedUnits += qty;
      continue;
    }
    const existing = byProduct.get(product.id);
    const revenueMinor = line.unit_price_minor * qty;
    if (existing) {
      existing.units += qty;
      existing.revenueMinor += revenueMinor;
      existing.marginMinor += marginUnit * qty;
    } else {
      byProduct.set(product.id, {
        productId: product.id,
        name: product.name,
        units: qty,
        revenueMinor,
        marginMinor: marginUnit * qty,
        marginPct: productMarginPct(product, cost),
      });
    }
  }

  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.marginMinor - a.marginMinor)
    .slice(0, 8);

  // --- Top clients (money received this month, from transactions) ------------
  const revenueRows = monthTransactions
    .filter((tx) => tx.source_type === "order")
    .map((tx) => ({
      source_id: tx.source_id,
      direction: tx.direction,
      amount_minor: tx.amount_minor,
      occurred_on: tx.occurred_on,
    }));
  const clientRevenue = revenueByClient(orders, revenueRows);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const topClients = [...clientRevenue.entries()]
    .map(([clientId, minor]) => ({
      name: clientById.get(clientId)?.name ?? null,
      minor,
    }))
    .filter((row) => row.name != null && row.minor > 0)
    .sort((a, b) => b.minor - a.minor)
    .slice(0, 8);

  const monthLabel = formatDate(monthStart, locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <PrintShell backHref="/finance">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {settings?.business_name || t("report.title")}
          </h1>
          <p className="mt-1 text-sm text-[#4b5563]">{t("report.title")}</p>
        </div>
        <div className="text-end">
          <p className="text-lg font-medium">{monthLabel}</p>
        </div>
      </header>

      {/* 2 — Totals */}
      <section className="mt-8">
        <div className="grid grid-cols-3 gap-4">
          <Stat label={t("report.income")} value={formatMinor(monthTotals.inMinor)} />
          <Stat
            label={t("report.expense")}
            value={formatMinor(monthTotals.outMinor)}
          />
          <Stat
            label={t("report.net")}
            value={formatMinor(monthTotals.netMinor)}
            strong
          />
        </div>
        <p className="mt-3 text-sm text-[#4b5563]">
          {t("report.vsLastMonth")}:{" "}
          <span className="tabular-nums" dir="ltr">
            {netDelta >= 0 ? "+" : "−"}
            {formatMinor(Math.abs(netDelta))}
          </span>
          {netDeltaPct != null && (
            <span className="tabular-nums" dir="ltr">
              {" "}
              ({netDeltaPct >= 0 ? "+" : "−"}
              {Math.abs(netDeltaPct)}%)
            </span>
          )}
        </p>
      </section>

      {/* 3 — Spending by category */}
      <Section title={t("report.byCategory")}>
        {catSlices.length === 0 ? (
          <Empty label={t("report.noData")} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#111827]">
                <th className="py-2 text-start font-medium">
                  {t("report.byCategory")}
                </th>
                <th className="py-2 text-end font-medium">{t("report.expense")}</th>
              </tr>
            </thead>
            <tbody>
              {catSlices.map((slice: CategorySlice) => (
                <tr key={slice.id} className="border-b border-[#e5e7eb]">
                  <td className="py-2 pe-3">{slice.name}</td>
                  <td className="py-2 text-end tabular-nums" dir="ltr">
                    {formatMinor(slice.totalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 4 — Top products by margin */}
      <Section title={t("report.topProducts")}>
        {topProducts.length === 0 ? (
          <Empty label={t("report.noData")} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#111827]">
                <th className="py-2 text-start font-medium">{t("report.title")}</th>
                <th className="py-2 text-end font-medium">{t("report.units")}</th>
                <th className="py-2 text-end font-medium">{t("report.revenue")}</th>
                <th className="py-2 text-end font-medium">{t("report.margin")}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((row) => (
                <tr key={row.productId} className="border-b border-[#e5e7eb]">
                  <td className="py-2 pe-3">{row.name}</td>
                  <td className="py-2 text-end tabular-nums">{row.units}</td>
                  <td className="py-2 text-end tabular-nums" dir="ltr">
                    {formatMinor(row.revenueMinor)}
                  </td>
                  <td className="py-2 text-end tabular-nums" dir="ltr">
                    {formatMinor(row.marginMinor)}
                    {row.marginPct != null && (
                      <span className="text-[#6b7280]"> ({row.marginPct}%)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {uncostedUnits > 0 && (
          <p className="mt-2 text-xs text-[#6b7280]">
            {t("report.uncosted", { count: uncostedUnits })}
          </p>
        )}
      </Section>

      {/* 5 — Top clients */}
      <Section title={t("report.topClients")}>
        {topClients.length === 0 ? (
          <Empty label={t("report.noData")} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#111827]">
                <th className="py-2 text-start font-medium">
                  {t("report.topClients")}
                </th>
                <th className="py-2 text-end font-medium">{t("report.revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((row, i) => (
                <tr key={i} className="border-b border-[#e5e7eb]">
                  <td className="py-2 pe-3">{row.name}</td>
                  <td className="py-2 text-end tabular-nums" dir="ltr">
                    {formatMinor(row.minor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <p className="mt-10 border-t border-[#e5e7eb] pt-4 text-xs text-[#6b7280]">
        {t("report.generatedNote")}
      </p>
    </PrintShell>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "rounded-md border-2 border-[#111827] px-3 py-2"
          : "rounded-md border border-[#e5e7eb] px-3 py-2"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-1 text-lg font-semibold tabular-nums"
            : "mt-1 text-lg tabular-nums"
        }
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#374151]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-[#9ca3af]">{label}</p>;
}
