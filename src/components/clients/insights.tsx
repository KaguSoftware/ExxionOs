"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useChartMode } from "@/components/finance/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { CATEGORY_COLORS, OTHER_COLOR } from "@/lib/chart-palette";
import {
  CLIENT_SOURCE_KEY,
  bySource,
  goneQuiet,
  newVsReturning,
  repeatRate,
  topClients,
  type ClientOrderRow,
} from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import type { Client } from "@/lib/types";
import { formatMinor } from "@/lib/utils";

/**
 * ⚠️ EVERY FIGURE ON THIS TAB IS MONEY THAT ARRIVED.
 *
 * `revenue` is built by `revenueByClient()` from the `transactions` rows the
 * order payments wrote — never from `orders.total_minor`. Ranking clients by
 * agreed prices would put someone who has paid nothing at the top of "top
 * clients", and Parsa would ring them to say thanks.
 */
export function ClientInsights({
  clients,
  orders,
  revenue,
  today,
}: {
  clients: Client[];
  orders: ClientOrderRow[];
  revenue: Map<string, number>;
  today: string;
}) {
  // ⚠️ No `locale` here on purpose: every figure on this tab is money, and
  // `formatMinor` is deliberately locale-free — money stays in Latin digits
  // even in Farsi, because figures get compared down a column and copied into
  // invoices. See the note on `formatMoney` in lib/utils.ts.
  const { t } = useI18n();
  const mode = useChartMode();

  const active = useMemo(() => clients.filter((c) => !c.archived_at), [clients]);
  const top = useMemo(
    () => topClients(active, orders, revenue, today),
    [active, orders, revenue, today]
  );
  const repeat = useMemo(() => repeatRate(orders), [orders]);
  const split = useMemo(() => newVsReturning(orders, revenue), [orders, revenue]);
  const sources = useMemo(() => bySource(active, revenue), [active, revenue]);
  const quiet = useMemo(
    () => goneQuiet(clients, orders, revenue, today),
    [clients, orders, revenue, today]
  );

  const palette = CATEGORY_COLORS[mode];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t("clients.topClients")} description={t("clients.topClientsHint")}>
        {top.length === 0 ? (
          <EmptyState title={t("clients.notEnoughData")} />
        ) : (
          <BarList
            rows={top.map(({ client, stats }, i) => ({
              id: client.id,
              href: `/clients/${client.id}`,
              label: client.name,
              value: stats.lifetimeMinor,
              color: palette[i % palette.length],
            }))}
          />
        )}
      </Panel>

      <Panel title={t("clients.whereFrom")} description={t("clients.whereFromHint")}>
        {sources.length === 0 ? (
          <EmptyState title={t("clients.notEnoughData")} />
        ) : (
          <BarList
            rows={sources.map((bucket, i) => ({
              id: bucket.source ?? "__unknown",
              label: bucket.source
                ? t(CLIENT_SOURCE_KEY[bucket.source] as never)
                : t("clients.sourceUnknown"),
              // The unknown bucket takes the neutral grey rather than a hue —
              // it is the absence of an answer, not another channel.
              color: bucket.source ? palette[i % palette.length] : OTHER_COLOR[mode],
              value: bucket.minor,
              hint: t("clients.clientsCount", { count: bucket.clients }),
            }))}
          />
        )}
      </Panel>

      <Panel title={t("clients.repeatRate")} description={t("clients.repeatRateHint")}>
        {/* ⚠️ null, not 0 — a rate over zero clients rendered as "0%" reads as
            "nobody ever comes back", a claim about the business rather than
            about the data. */}
        {repeat == null ? (
          <EmptyState title={t("clients.notEnoughData")} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-3xl font-semibold text-ink tabular-nums">
              {Math.round(repeat * 100)}%
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat
                label={t("clients.returningClients")}
                count={split.returningClients}
                money={formatMinor(split.returningMinor)}
              />
              <Stat
                label={t("clients.newClients")}
                count={split.newClients}
                money={formatMinor(split.newMinor)}
              />
            </dl>
          </div>
        )}
      </Panel>

      <Panel title={t("clients.goneQuiet")} description={t("clients.goneQuietHint")}>
        {quiet.length === 0 ? (
          <EmptyState title={t("clients.goneQuietEmpty")} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {quiet.map(({ client, stats }) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1 text-sm hover:bg-raised"
                >
                  <span className="min-w-0 truncate text-ink">{client.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {t("clients.daysAgo", { count: stats.daysSinceLastOrder ?? 0 })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  label,
  count,
  money,
}: {
  label: string;
  count: number;
  money: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">
        <span className="text-lg font-medium tabular-nums">{count}</span>
        <span className="ms-2 text-xs text-faint tabular-nums">{money}</span>
      </dd>
    </div>
  );
}

/**
 * Horizontal bars with a value label on every row — the same shape as
 * `CategoryChart` in `finance/charts.tsx`, and for the same reason: the names
 * are words, they read straight without rotation, and a label per row means
 * the reader never needs an axis. Stays legible on a phone.
 */
function BarList({
  rows,
}: {
  rows: {
    id: string;
    label: string;
    value: number;
    color: string;
    href?: string;
    hint?: string;
  }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted">
                {row.label}
                {row.hint && <span className="ms-1.5 text-faint">{row.hint}</span>}
              </span>
              <span className="shrink-0 font-medium text-ink tabular-nums">
                {formatMinor(row.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </>
        );

        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className="block rounded-md hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
