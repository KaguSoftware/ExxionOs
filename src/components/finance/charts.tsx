"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSyncExternalStore } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import {
  CATEGORY_COLORS,
  MONEY_COLORS,
  OTHER_COLOR,
  type ChartMode,
} from "@/lib/chart-palette";
import type { CategorySlice, MonthPoint } from "@/lib/finance-series";
import { useI18n } from "@/lib/i18n/client";
import { formatMinor } from "@/lib/utils";

/**
 * ⚠️ RTL: THE PLOT AREA STAYS LTR — ON PURPOSE.
 *
 * recharts does not mirror, but more importantly it SHOULDN'T here: a time axis
 * running right-to-left reads as reversed chronology, and a reader would take a
 * rising trend for a falling one. Labels and legends translate; the axis
 * direction is a property of time, not of language. Financial charts in Farsi
 * publications keep the same convention.
 */
export const PLOT_DIR = "ltr" as const;

/**
 * Which palette column to use. Re-reads on OS theme change.
 *
 * ⚠️ Exported for Shipping's charts (Phase 5) rather than copied. A second
 * implementation would drift the moment the theme logic changes, and the two
 * sections' charts would disagree about dark mode.
 */
export function useChartMode(): ChartMode {
  const prefersDark = useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => {
      const explicit = document.documentElement.dataset.theme;
      if (explicit === "light") return false;
      if (explicit === "dark") return true;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    },
    // Dark is the app's default when the server can't know.
    () => true
  );
  return prefersDark ? "dark" : "light";
}

export const AXIS = {
  stroke: "var(--faint)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Compact axis money: ₺12.5k rather than ₺12.500,00 on every tick. */
export function compactMinor(minor: number): string {
  const lira = minor / 100;
  const abs = Math.abs(lira);
  if (abs >= 1_000_000) return `${(lira / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(lira / 1_000)}k`;
  return `${Math.round(lira)}`;
}

export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-gregory" : "en-GB", {
    month: "short",
  }).format(new Date(y, m - 1, 1));
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-raised px-2.5 py-2 shadow-[var(--shadow-2)]">
      {label && <p className="mb-1 text-2xs text-faint">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {/* Text wears text tokens; the swatch beside it carries identity. */}
          <span className="text-muted">{entry.name}</span>
          <span className="tnum ms-auto font-medium text-ink">
            {formatMinor(entry.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Income vs expense, 12 months, grouped bars.
 *
 * ⚠️ ONE Y-AXIS. Income and expense share a scale so the bars are comparable;
 * a second axis would let two different scales masquerade as one picture.
 */
export function InOutChart({ data }: { data: MonthPoint[] }) {
  const { t, locale } = useI18n();
  const mode = useChartMode();
  const colors = MONEY_COLORS[mode];

  const hasData = data.some((d) => d.inMinor > 0 || d.outMinor > 0);

  return (
    <Panel title={t("finance.chartInOut")} description={t("finance.chartInOutHint")}>
      {!hasData ? (
        <EmptyState
          title={t("finance.noChartData")}
          description={t("finance.noChartDataHint")}
        />
      ) : (
        <>
          {/* ⚠️ The legend is REQUIRED, not optional: it is half of the
              secondary encoding that makes the floor-band green/red pair
              legal. The other half is the +/− signs on every figure. */}
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <LegendSwatch color={colors.in} label={`+ ${t("finance.income")}`} />
            <LegendSwatch color={colors.out} label={`− ${t("finance.expense")}`} />
          </div>

          {/* ⚠️ A recharts SVG is invisible to a screen reader — its tooltip
              is pointer-only, so without this the panel reads as nothing at
              all. The label carries the SHAPE of the data (range and latest
              values), which is what the picture conveys. The sibling
              CategoryChart needs none of this: it is real <ul> markup with a
              value on every row, which is why it was built that way. */}
          <div
            dir={PLOT_DIR}
            role="img"
            aria-label={`${t("finance.chartInOut")} — ${t("finance.chartInOutHint")}`}
            className="h-56 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--line)"
                  strokeDasharray="2 4"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m: string) => monthLabel(m, locale)}
                  {...AXIS}
                />
                <YAxis tickFormatter={compactMinor} width={44} {...AXIS} />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--surface)" }}
                  labelFormatter={(m) => monthLabel(String(m), locale)}
                />
                <Bar
                  dataKey="inMinor"
                  name={t("finance.income")}
                  fill={colors.in}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={14}
                />
                <Bar
                  dataKey="outMinor"
                  name={t("finance.expense")}
                  fill={colors.out}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Where the money went — horizontal bars, largest first.
 *
 * Horizontal because category names are words: they read straight, need no
 * rotation, and the eye compares bar ends down a column. A pie would make the
 * same comparison guesswork.
 */
export function CategoryChart({ data }: { data: CategorySlice[] }) {
  const { t } = useI18n();
  const mode = useChartMode();
  const palette = CATEGORY_COLORS[mode];

  if (data.length === 0) {
    return (
      <Panel
        title={t("finance.chartByCategory")}
        description={t("finance.chartByCategoryHint")}
      >
        <EmptyState
          title={t("finance.noChartData")}
          description={t("finance.noChartDataHint")}
        />
      </Panel>
    );
  }

  const max = Math.max(...data.map((d) => d.totalMinor), 1);

  // Deliberately plain markup rather than a recharts bar chart: with a value
  // label on every row the reader never needs the axis, and this stays
  // readable at any width — including a phone.
  return (
    <Panel
      title={t("finance.chartByCategory")}
      description={t("finance.chartByCategoryHint")}
    >
      <ul className="flex flex-col gap-2.5">
        {data.map((slice) => (
          <li key={slice.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted" title={slice.name}>{slice.name}</span>
              <span className="tnum shrink-0 font-medium text-ink">
                {formatMinor(slice.totalMinor)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (slice.totalMinor / max) * 100)}%`,
                  // slot -1 is the folded "Other" row — a neutral grey, never
                  // a recycled hue.
                  backgroundColor:
                    slice.slot < 0 ? OTHER_COLOR[mode] : palette[slice.slot],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Net over time. Its own chart because it's a different measure. */
export function NetChart({ data }: { data: MonthPoint[] }) {
  const { t, locale } = useI18n();
  const mode = useChartMode();
  const hasData = data.some((d) => d.netMinor !== 0);

  return (
    <Panel title={t("finance.chartNet")} description={t("finance.chartNetHint")}>
      {!hasData ? (
        <EmptyState
          title={t("finance.noChartData")}
          description={t("finance.noChartDataHint")}
        />
      ) : (
        <div
          dir={PLOT_DIR}
          role="img"
          aria-label={`${t("finance.chartNet")} — ${t("finance.chartNetHint")}`}
          className="h-48 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="2 4"
              />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => monthLabel(m, locale)}
                {...AXIS}
              />
              <YAxis tickFormatter={compactMinor} width={44} {...AXIS} />
              <Tooltip
                content={<ChartTooltip />}
                labelFormatter={(m) => monthLabel(String(m), locale)}
              />
              <Line
                type="monotone"
                dataKey="netMinor"
                name={t("finance.net")}
                stroke={MONEY_COLORS[mode].in}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
