"use client";

import { useMemo } from "react";

import { useChartMode } from "@/components/finance/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { CATEGORY_COLORS, OTHER_COLOR } from "@/lib/chart-palette";
import { CLIENT_SOURCE_KEY } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import {
  campaignRoi,
  givenAwayMinor,
  newClientsBySourceByMonth,
} from "@/lib/marketing";
import type {
  Campaign,
  Client,
  ClientSource,
  Supply,
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
 * ⚠️ ROI HERE IS HUMAN-ATTRIBUTED, NEVER INFERRED.
 *
 * Phase 7 refused any "this campaign earned ₺X" figure because nothing in the
 * data linked an order to a campaign, and an invented attribution number is
 * worse than none — it gets believed and then spent against. Migration 0019
 * added `orders.campaign_id`: a human can now tag the campaign that won an
 * order. The ROI panel below reports return ONLY over those tagged orders, with
 * the untagged count stated out loud, and revenue read from `transactions`
 * (money that arrived), never from `orders.total_minor`. The software still
 * makes no claim the human didn't; it just totals what the human recorded.
 *
 * The channel signal (which channel new clients SAID they came from) stays what
 * it was — a signal, not proof — and is deliberately separate from ROI.
 */
export function MarketingInsights({
  campaigns,
  spend,
  samples,
  products,
  supplies,
  machineRateMinor,
  clients,
  taggedOrders,
  orderRevenue,
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
  supplies: Supply[];
  machineRateMinor: number;
  clients: Client[];
  /** Orders carrying a campaign tag (or null) — feeds real ROI (0019). */
  taggedOrders: { id: string; campaign_id: string | null }[];
  /** Money that ARRIVED per order, from `transactions` — never order totals. */
  orderRevenue: { order_id: string; amount_minor: number }[];
}) {
  const { t } = useI18n();
  const mode = useChartMode();
  const palette = CATEGORY_COLORS[mode];

  /**
   * ⚠️ REAL ROI, from human-tagged orders only. Revenue is money received
   * (`transactions` → order), spend is the ledger (`campaign_costs`). The
   * untagged count is shown so the figure never claims to cover the whole book.
   */
  const receivedByOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of orderRevenue) {
      map.set(row.order_id, (map.get(row.order_id) ?? 0) + row.amount_minor);
    }
    return map;
  }, [orderRevenue]);

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

  const { roi, untaggedOrders } = useMemo(() => {
    const byName = new Map(campaigns.map((c) => [c.id, c.name]));
    const result = campaignRoi(campaigns, taggedOrders, receivedByOrder, spendByCampaign);
    return {
      roi: result.roi
        // Show only campaigns that have some tagged activity — a campaign with
        // no tagged order and no spend has nothing to say about ROI.
        .filter((r) => r.orderCount > 0 || r.spendMinor > 0)
        .map((r) => ({ ...r, name: byName.get(r.campaignId) ?? "" }))
        .sort((a, b) => b.netMinor - a.netMinor),
      untaggedOrders: result.untaggedOrders,
    };
  }, [campaigns, taggedOrders, receivedByOrder, spendByCampaign]);

  const given = useMemo(
    () => givenAwayMinor(samples, products, supplies, machineRateMinor),
    [samples, products, supplies, machineRateMinor]
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
                  <span className="min-w-0 truncate text-muted" title={row.campaign.name}>{row.campaign.name}</span>
                  <span className="shrink-0 font-medium text-ink tnum">
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
        title={t("marketing.roi")}
        description={t("marketing.roiHint")}
      >
        {roi.length === 0 ? (
          <EmptyState
            title={t("marketing.roiEmpty")}
            description={t("marketing.roiEmptyHint")}
          />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line">
              {roi.map((row) => (
                <li
                  key={row.campaignId}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink" title={row.name}>
                      {row.name}
                    </p>
                    <p className="text-2xs text-faint tnum">
                      {formatMinor(row.revenueMinor)} − {formatMinor(row.spendMinor)} ·{" "}
                      {t("marketing.roiOrders", { count: row.orderCount })}
                    </p>
                  </div>
                  {/* ⚠️ +/− is REQUIRED secondary encoding for the green/red
                      floor-band pair — never colour alone. */}
                  <span
                    className={
                      "tnum shrink-0 text-sm font-semibold " +
                      (row.netMinor >= 0 ? "text-success" : "text-danger")
                    }
                  >
                    {row.netMinor >= 0 ? "+" : "−"}
                    {formatMinor(Math.abs(row.netMinor))}
                  </span>
                </li>
              ))}
            </ul>
            {/* ⚠️ The untagged orders are stated out loud: ROI covers only what
                a human attributed, and hiding the rest would let the figure
                pose as the whole business. */}
            {untaggedOrders > 0 && (
              <p className="mt-3 border-t border-line pt-2 text-2xs text-faint">
                {t("marketing.roiUntagged", { count: untaggedOrders })}
              </p>
            )}
          </>
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
            <p className="text-3xl font-semibold text-ink tnum">
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
                  <span className="shrink-0 font-medium text-ink tnum">
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
