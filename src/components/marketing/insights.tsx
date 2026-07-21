"use client";

import { useMemo } from "react";

import { useChartMode } from "@/components/finance/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { CATEGORY_COLORS, OTHER_COLOR } from "@/lib/chart-palette";
import { CLIENT_SOURCE_KEY } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import { givenAwayMinor, newClientsBySourceByMonth } from "@/lib/marketing";
import type {
  Campaign,
  Client,
  ClientSource,
  Material,
  Product,
  Sample,
  Transaction,
} from "@/lib/types";
import { formatMinor } from "@/lib/utils";

export type MarketingSpendRow = Pick<
  Transaction,
  "source_id" | "direction" | "amount_minor" | "occurred_on"
>;

/**
 * ⚠️ WHAT THIS TAB DELIBERATELY DOES NOT CLAIM.
 *
 * There is no "this campaign earned ₺X" figure anywhere here, and there must
 * not be one: nothing in the data proves a given order was caused by a given
 * campaign. An invented attribution number is worse than none, because it gets
 * believed and then spent against. What is reported is what can be defended —
 * money that actually went out, what the giveaways were worth, and which
 * channel new clients SAID they came from. Reading a rise next to a campaign is
 * a judgement the human makes; the software does not make it for them.
 *
 * If real ROI is ever wanted, it needs `orders.campaign_id` and the discipline
 * of tagging every order — a decision, not a chart.
 */
export function MarketingInsights({
  campaigns,
  spend,
  samples,
  products,
  materials,
  machineRateMinor,
  clients,
}: {
  campaigns: Campaign[];
  /**
   * ⚠️ From `transactions` — the LEDGER, not the budget column and not the
   * `campaign_costs` rows. The cost rows are the input that CREATED these; the
   * transaction is the money. Taking `costs` here too would invite someone to
   * add the two and report double, which is the bug this whole app keeps
   * refusing to ship.
   */
  spend: MarketingSpendRow[];
  samples: Sample[];
  products: Product[];
  materials: Material[];
  machineRateMinor: number;
  clients: Client[];
}) {
  const { t } = useI18n();
  const mode = useChartMode();
  const palette = CATEGORY_COLORS[mode];

  /**
   * ⚠️ SPEND IS READ FROM FINANCE, not from summing `campaigns.budget_minor`
   * (the plan) — and not by adding the two, which reports roughly double. Same
   * rule as machine spend (Phase 4) and order revenue (Phase 5).
   */
  const spendByCampaign = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of spend) {
      if (!row.source_id) continue;
      const signed = row.direction === "out" ? row.amount_minor : -row.amount_minor;
      map.set(row.source_id, (map.get(row.source_id) ?? 0) + signed);
    }
    return map;
  }, [spend]);

  const spendRows = useMemo(
    () =>
      campaigns
        .map((c) => ({ campaign: c, minor: spendByCampaign.get(c.id) ?? 0 }))
        .filter((r) => r.minor > 0)
        .sort((a, b) => b.minor - a.minor)
        .slice(0, 8),
    [campaigns, spendByCampaign]
  );

  const given = useMemo(
    () => givenAwayMinor(samples, products, materials, machineRateMinor),
    [samples, products, materials, machineRateMinor]
  );

  const { months, bySource } = useMemo(
    () => newClientsBySourceByMonth(clients),
    [clients]
  );

  const sourceRows = useMemo(() => {
    const rows: { key: string; label: string; total: number }[] = [];
    for (const [key, series] of bySource) {
      rows.push({
        key,
        label:
          key === "__unknown"
            ? t("clients.sourceUnknown")
            : t(CLIENT_SOURCE_KEY[key as ClientSource] as never),
        total: series.reduce((sum, p) => sum + p.count, 0),
      });
    }
    return rows.sort((a, b) => b.total - a.total);
  }, [bySource, t]);

  const maxSpend = Math.max(...spendRows.map((r) => r.minor), 1);
  const maxSource = Math.max(...sourceRows.map((r) => r.total), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title={t("marketing.spendByCampaign")}
        description={t("marketing.spendByCampaignHint")}
      >
        {spendRows.length === 0 ? (
          <EmptyState title={t("marketing.notEnoughData")} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {spendRows.map((row, i) => (
              <li key={row.campaign.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted">{row.campaign.name}</span>
                  <span className="shrink-0 font-medium text-ink tabular-nums">
                    {formatMinor(row.minor)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (row.minor / maxSpend) * 100)}%`,
                      backgroundColor: palette[i % palette.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={t("marketing.whatWeGaveAway")}
        description={t("marketing.whatWeGaveAwayHint")}
      >
        {samples.length === 0 ? (
          <EmptyState title={t("marketing.notEnoughData")} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-semibold text-ink tabular-nums">
              {formatMinor(given.totalMinor)}
            </p>
            <p className="text-xs text-muted">
              {given.costedCount} / {samples.length}
            </p>
            {/* ⚠️ The uncosted rows are stated, not hidden — otherwise the big
                number above looks like the whole truth when it isn't. */}
            {given.uncostedCount > 0 && (
              <p className="text-2xs text-faint">
                {t("marketing.uncosted", { count: given.uncostedCount })} ·{" "}
                {t("marketing.uncostedHint")}
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={t("marketing.newClientsBySource")}
        description={t("marketing.newClientsBySourceHint")}
        className="lg:col-span-2"
      >
        {sourceRows.length === 0 ? (
          <EmptyState title={t("marketing.notEnoughData")} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sourceRows.map((row, i) => (
              <li key={row.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted">{row.label}</span>
                  <span className="shrink-0 font-medium text-ink tabular-nums">
                    {row.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (row.total / maxSource) * 100)}%`,
                      // The unknown bucket takes neutral grey, never a hue —
                      // it is the absence of an answer, not another channel.
                      backgroundColor:
                        row.key === "__unknown"
                          ? OTHER_COLOR[mode]
                          : palette[i % palette.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {months.length > 0 && (
          <p className="mt-3 border-t border-line pt-2 text-2xs text-faint">
            {months[0]} — {months[months.length - 1]}
          </p>
        )}
      </Panel>
    </div>
  );
}
