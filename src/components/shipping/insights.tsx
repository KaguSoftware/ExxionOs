"use client";

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
  monthLabel,
  useChartMode,
} from "@/components/finance/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { MONEY_COLORS } from "@/lib/chart-palette";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY, lostRate, medianStageDurations, msToDays } from "@/lib/shipping";
import type { Order, OrderStageEvent } from "@/lib/types";
import type { RevenueRow } from "@/components/shipping/panels";

/**
 * ⚠️ CHARTS STAY LTR IN FARSI (`PLOT_DIR`). A time axis running right-to-left
 * reads as reversed chronology — a reader would take a rising trend for a
 * falling one. Labels translate; the direction of time does not.
 */
export function ShippingInsights({
  orders,
  stageEvents,
  revenue,
  today,
}: {
  orders: Order[];
  stageEvents: OrderStageEvent[];
  revenue: RevenueRow[];
  /**
   * ⚠️ PASSED IN as a DATE, never read as `Date.now()` during render. An impure
   * call in render gives a different answer on every re-render, so a stage's
   * measured duration would creep upward as the user clicked around —
   * `react-hooks/purity` is an error here for exactly that reason. Cycle time
   * is reported in whole days, so day resolution loses nothing.
   */
  today: string;
}) {
  const { t, locale } = useI18n();
  const mode = useChartMode();
  const colors = MONEY_COLORS[mode];

  /** One instant for every open stage, so no two rows disagree. */
  const cycle = useMemo(() => {
    const byOrder = new Map<string, OrderStageEvent[]>();
    for (const e of stageEvents) {
      const list = byOrder.get(e.order_id);
      if (list) list.push(e);
      else byOrder.set(e.order_id, [e]);
    }
    // End of the current day in Istanbul, so a stage entered this morning
    // reads as "today" rather than as a negative span.
    const nowMs = Date.parse(`${today}T23:59:59Z`);
    return medianStageDurations(byOrder, nowMs).map((d) => ({
      stage: t(STAGE_KEY[d.stage] as never),
      days: msToDays(d.ms),
    }));
  }, [stageEvents, today, t]);

  const lost = lostRate(orders);

  /** Money RECEIVED per month — read from Finance, never from order totals. */
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of revenue) {
      const month = row.occurred_on.slice(0, 7);
      const signed =
        row.direction === "in" ? row.amount_minor : -row.amount_minor;
      map.set(month, (map.get(month) ?? 0) + signed);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, minor]) => ({ month, minor }));
  }, [revenue]);

  const delivered = orders.filter((o) => o.stage === "delivered").length;
  const cancelled = orders.filter((o) => o.stage === "cancelled").length;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={t("shipping.revenueByMonth")}
        description={t("shipping.revenueHint")}
      >
        {byMonth.length === 0 ? (
          <EmptyState title={t("shipping.notEnoughData")} />
        ) : (
          <div dir={PLOT_DIR} className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="month"
                  {...AXIS}
                  tickFormatter={(m) => monthLabel(String(m), locale)}
                />
                <YAxis {...AXIS} width={44} tickFormatter={compactMinor} />
                <Tooltip
                  cursor={{ fill: "var(--raised)" }}
                  content={<ChartTooltip />}
                  labelFormatter={(m) => monthLabel(String(m), locale)}
                />
                <Bar
                  dataKey="minor"
                  name={t("shipping.paid")}
                  fill={colors.in}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title={t("shipping.cycleTime")} description={t("shipping.cycleTimeHint")}>
        {cycle.length === 0 ? (
          <EmptyState title={t("shipping.notEnoughData")} />
        ) : (
          <div dir={PLOT_DIR} className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cycle}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
              >
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" {...AXIS} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  {...AXIS}
                  width={92}
                />
                <Tooltip
                  cursor={{ fill: "var(--raised)" }}
                  formatter={(value) => [
                    t("shipping.daysCount", { count: String(value) }),
                    "",
                  ]}
                />
                <Bar
                  dataKey="days"
                  name={t("shipping.days")}
                  fill="var(--brand)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title={t("shipping.lostRate")} description={t("shipping.lostRateHint")}>
        {lost == null ? (
          <EmptyState title={t("shipping.notEnoughData")} />
        ) : (
          <div className="flex items-baseline gap-3">
            <p className="tnum text-2xl font-semibold text-ink">
              {Math.round(lost * 100)}%
            </p>
            {/* The rate alone hides its own sample size — 1 of 2 and 50 of 100
                are not the same claim, so the counts stay beside it. */}
            <p className="text-xs text-muted">
              {cancelled} / {delivered + cancelled}
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
