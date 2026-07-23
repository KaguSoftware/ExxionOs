"use client";

import { PackageX } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS,
  ChartTooltip,
  PLOT_DIR,
  compactMinor,
  useChartMode,
} from "@/components/finance/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { MONEY_COLORS } from "@/lib/chart-palette";
import { useI18n } from "@/lib/i18n/client";
import { scrapStats } from "@/lib/print-analytics";
import type { PrintRun, Product, Supply } from "@/lib/types";
import { formatMinor } from "@/lib/utils";

/** Whole grams — waste is never precise enough for decimals. */
function formatGrams(g: number): string {
  return `${Math.round(g).toLocaleString()} g`;
}

/**
 * The Creative "Insights" tab: what the print log says about waste.
 *
 * ⚠️ recharts lives in this module on purpose — the whole tab is lazy-loaded
 * via next/dynamic at the panel level, so importing the chart lib here keeps it
 * out of the page's first-load chunk.
 */
export function ScrapInsights({
  printRuns,
  products,
  supplies,
}: {
  printRuns: PrintRun[];
  products: Pick<Product, "id" | "name">[];
  supplies: Pick<Supply, "id" | "cost_per_kg_minor">[];
}) {
  const { t } = useI18n();
  const mode = useChartMode();
  const colors = MONEY_COLORS[mode];

  const stats = useMemo(
    () => scrapStats(printRuns, products, supplies),
    [printRuns, products, supplies]
  );

  if (stats.totalUnits === 0) {
    return (
      <EmptyState
        icon={<PackageX aria-hidden className="size-4" />}
        title={t("creative.scrapEmpty")}
        description={t("creative.scrapEmptyHint")}
      />
    );
  }

  const chartData = stats.byProduct.slice(0, 8).map((row) => ({
    name: row.productName,
    value: row.wastedMinor,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label={t("creative.scrapRate")}>
          <span className="tnum text-lg font-semibold text-ink">
            {stats.scrapRate == null
              ? "—"
              : `${Math.round(stats.scrapRate * 100)}%`}
          </span>
        </Stat>
        <Stat label={t("creative.wastedGrams")}>
          <span className="tnum text-lg font-semibold text-ink">
            {formatGrams(stats.wastedGrams)}
          </span>
        </Stat>
        <Stat
          label={t("creative.wastedValue")}
          hint={
            stats.uncostedRuns > 0
              ? t("creative.scrapUncosted", { count: stats.uncostedRuns })
              : undefined
          }
        >
          <span className="tnum text-lg font-semibold text-danger">
            {formatMinor(stats.wastedMinor)}
          </span>
        </Stat>
        <Stat label={t("creative.testPrints")}>
          <span className="text-sm text-ink">
            {t("creative.testPrintsValue", {
              units: stats.testUnits,
              grams: Math.round(stats.testGrams),
            })}
          </span>
        </Stat>
      </div>

      {chartData.length > 0 && (
        <Panel title={t("creative.wasteByProduct")}>
          <div dir={PLOT_DIR} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} width={44} tickFormatter={compactMinor} />
                <Tooltip
                  cursor={{ fill: "var(--raised)" }}
                  content={<ChartTooltip />}
                />
                <Bar
                  dataKey="value"
                  name={t("creative.wastedValue")}
                  fill={colors.out}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel title={t("creative.wasteByProduct")} bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-2xs text-muted">
              <th className="px-4 py-2 text-start font-medium">
                {t("creative.wasteProductCol")}
              </th>
              <th className="px-4 py-2 text-end font-medium">
                {t("creative.wasteFailedUnits")}
              </th>
              <th className="px-4 py-2 text-end font-medium">
                {t("creative.wasteScrapRate")}
              </th>
              <th className="px-4 py-2 text-end font-medium">
                {t("creative.wasteGramsCol")}
              </th>
              <th className="px-4 py-2 text-end font-medium">
                {t("creative.wasteValueCol")}
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.byProduct.map((row) => (
              <tr
                key={row.productId ?? "__deleted__"}
                className="border-b border-line last:border-0"
              >
                <td className="truncate px-4 py-2.5 text-ink">
                  {row.productName}
                </td>
                <td className="tnum px-4 py-2.5 text-end text-muted">
                  {row.failedUnits}
                </td>
                <td className="tnum px-4 py-2.5 text-end text-muted">
                  {row.scrapRate == null
                    ? "—"
                    : `${Math.round(row.scrapRate * 100)}%`}
                </td>
                <td className="tnum px-4 py-2.5 text-end text-muted">
                  {formatGrams(row.wastedGrams)}
                </td>
                <td className="tnum px-4 py-2.5 text-end text-danger">
                  {formatMinor(row.wastedMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Stat({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-0.5 text-2xs text-faint">{hint}</p>}
    </div>
  );
}
