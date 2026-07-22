"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { productCost } from "@/lib/costing";
import type { Product, Supply } from "@/lib/types";
import { cn, formatMinor } from "@/lib/utils";

export type SoldLine = {
  product_id: string;
  quantity: number;
  unit_price_minor: number;
};

/**
 * Per-collection P&L — deferred since Phase 3 with "once orders exist", and
 * now real.
 *
 * ⚠️ TWO HONESTY RULES, both easy to get wrong:
 *
 * 1. **Revenue is what was SOLD, cost is what it cost to MAKE what was sold.**
 *    Cost is `productCost() × quantity sold`, never the cost of every product in
 *    the collection — a design nobody bought cost nothing to not print.
 *
 * 2. **Cost is still computed at read time** (Phase 3's rule). Re-pricing a
 *    filament moves this figure, which is correct: it answers "what would this
 *    have cost at today's prices", and a stored number would answer nothing
 *    reliably.
 *
 * ⚠️ Lines whose product was deleted are counted in revenue but cannot be
 * costed — the panel says so rather than quietly understating cost, which would
 * flatter the margin.
 */
export function CollectionPnl({
  products,
  supplies,
  machineRateMinor,
  soldLines,
}: {
  products: Product[];
  supplies: Supply[];
  machineRateMinor: number;
  soldLines: SoldLine[];
}) {
  const { t } = useI18n();

  const byProduct = new Map(products.map((p) => [p.id, p]));

  let revenueMinor = 0;
  let costMinor = 0;
  let unitsSold = 0;
  let uncostedUnits = 0;

  const rows = new Map<
    string,
    { name: string; units: number; revenue: number; cost: number | null }
  >();

  for (const line of soldLines) {
    const product = byProduct.get(line.product_id);
    if (!product) continue; // Belongs to another collection.

    const lineRevenue = line.quantity * line.unit_price_minor;
    revenueMinor += lineRevenue;
    unitsSold += line.quantity;

    const cost = productCost(product, supplies, machineRateMinor);
    const lineCost = cost ? cost.totalMinor * line.quantity : null;
    if (lineCost == null) uncostedUnits += line.quantity;
    else costMinor += lineCost;

    const existing = rows.get(product.id);
    if (existing) {
      existing.units += line.quantity;
      existing.revenue += lineRevenue;
      existing.cost =
        existing.cost == null || lineCost == null
          ? null
          : existing.cost + lineCost;
    } else {
      rows.set(product.id, {
        name: product.name,
        units: line.quantity,
        revenue: lineRevenue,
        cost: lineCost,
      });
    }
  }

  if (soldLines.length === 0 || unitsSold === 0) {
    return (
      <EmptyState
        icon={<Receipt aria-hidden className="size-4" />}
        title={t("creative.pnlEmpty")}
        description={t("creative.pnlEmptyHint")}
        // ⚠️ The description says "add an order in Shipping" — so LINK there.
        // Prose that tells you to navigate somewhere, without the link, makes
        // the reader do the work the sentence just described.
        action={
          <Link href="/shipping/orders/new">
            <Button size="sm">{t("shipping.newOrder")}</Button>
          </Link>
        }
      />
    );
  }

  const marginMinor = revenueMinor - costMinor;
  const sorted = [...rows.values()].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label={t("creative.pnlRevenue")} value={formatMinor(revenueMinor)} />
        <Figure label={t("creative.pnlCost")} value={formatMinor(costMinor)} />
        <Figure
          label={t("creative.pnlMargin")}
          value={formatMinor(marginMinor)}
          /* ⚠️ The sign is the secondary encoding, not the colour — measured
             green↔red ΔE 6.5 under protanopia sits in the floor band. */
          tone={marginMinor < 0 ? "negative" : "positive"}
          prefix={marginMinor < 0 ? "−" : "+"}
        />
      </div>

      {uncostedUnits > 0 && (
        <p className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
          {t("creative.pnlUncosted", { count: String(uncostedUnits) })}
        </p>
      )}

      <ul className="rounded-xl border border-line">
        {sorted.map((row, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-3 row-comfortable border-b border-line last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink" title={row.name}>{row.name}</p>
              <p className="mt-0.5 text-2xs text-faint">
                {t("creative.pnlUnitsSold", { count: String(row.units) })}
              </p>
            </div>
            <span className="tnum shrink-0 text-sm text-ink">
              {formatMinor(row.revenue)}
            </span>
            <span className="tnum w-24 shrink-0 text-end text-xs text-muted">
              {row.cost == null ? "—" : formatMinor(row.cost)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-2xs text-faint">{t("creative.pnlHint")}</p>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  prefix,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  prefix?: string;
}) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-lg font-semibold",
          tone === "negative"
            ? "text-danger"
            : tone === "positive"
              ? "text-success"
              : "text-ink"
        )}
      >
        {prefix}
        {value}
      </p>
    </div>
  );
}
