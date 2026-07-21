"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import {
  CAMPAIGN_CHANNEL_KEY,
  CAMPAIGN_STATUS_KEY,
  budgetUsage,
} from "@/lib/marketing";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from "@/lib/types";
import type { Campaign, CampaignCost } from "@/lib/types";
import { cn, formatMinor } from "@/lib/utils";

/** ⚠️ Filtering is 100% client-side — the rows are already here from the wave. */
export function CampaignList({
  campaigns,
  costsByCampaign,
}: {
  campaigns: Campaign[];
  costsByCampaign: Map<string, CampaignCost[]>;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");

  const rows = useMemo(
    () =>
      campaigns
        .filter((c) => !c.archived_at)
        .filter((c) => (!status || c.status === status) && (!channel || c.channel === channel))
        .sort(
          (a, b) =>
            (b.starts_on ?? "").localeCompare(a.starts_on ?? "") ||
            b.created_at.localeCompare(a.created_at)
        ),
    [campaigns, status, channel]
  );

  if (campaigns.filter((c) => !c.archived_at).length === 0) {
    return (
      <EmptyState
        icon={<Megaphone aria-hidden className="size-4" />}
        title={t("marketing.noCampaigns")}
        description={t("marketing.noCampaignsHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: t("marketing.allStatuses") },
            ...CAMPAIGN_STATUSES.map((s) => ({
              value: s,
              label: t(CAMPAIGN_STATUS_KEY[s] as never),
              count: campaigns.filter((c) => !c.archived_at && c.status === s).length,
            })),
          ]}
          label={t("marketing.status")}
          placeholder={t("marketing.allStatuses")}
          className="w-44"
        />
        <Dropdown
          value={channel}
          onChange={setChannel}
          options={[
            { value: "", label: t("marketing.allChannels") },
            ...CAMPAIGN_CHANNELS.map((c) => ({
              value: c,
              label: t(CAMPAIGN_CHANNEL_KEY[c] as never),
              count: campaigns.filter((x) => !x.archived_at && x.channel === c).length,
            })),
          ]}
          label={t("marketing.channel")}
          placeholder={t("marketing.allChannels")}
          className="w-44"
        />
      </div>

      {rows.length === 0 ? (
        /* ⚠️ NOT `noCampaigns` — campaigns DO exist here, the filters are
           hiding them. Reusing the "none yet" string states a falsehood about
           the data and offers no way out. Mirrors the pattern
           `finance/transaction-list.tsx` already gets right. */
        <EmptyState
          title={t("common.noResults")}
          description={t("common.noMatchesHint")}
          action={
            <Button
              size="sm"
              onClick={() => {
                setStatus("");
                setChannel("");
              }}
            >
              {t("common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/marketing/campaigns/${campaign.id}`}
                className="block rounded-xl border border-line p-3 transition-colors hover:bg-raised"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={campaign.name}>
                    {campaign.name}
                  </span>
                  {/* Category is the WORD in the neutral tone; only the
                      over-budget state earns a state colour. */}
                  <Badge>{t(CAMPAIGN_STATUS_KEY[campaign.status] as never)}</Badge>
                  <span className="text-2xs text-faint">
                    {t(CAMPAIGN_CHANNEL_KEY[campaign.channel] as never)}
                  </span>
                </div>
                <BudgetBar campaign={campaign} costs={costsByCampaign.get(campaign.id) ?? []} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Spent vs planned.
 *
 * ⚠️ WHEN THERE IS NO BUDGET IT SAYS SO — it does not draw an empty bar. A bar
 * at 0% reads as "plenty of headroom", which is a claim, and the wrong one: an
 * unbudgeted campaign has no headroom, it has no plan. `budgetUsage().ratio` is
 * null for exactly this case (see lib/marketing.ts).
 */
export function BudgetBar({
  campaign,
  costs,
}: {
  campaign: Campaign;
  costs: CampaignCost[];
}) {
  const { t } = useI18n();
  const { spentMinor, budgetMinor, ratio, overBudget } = budgetUsage(campaign, costs);

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">
          {t("marketing.spent")}{" "}
          <span className="font-medium text-ink tnum">
            {formatMinor(spentMinor)}
          </span>
          {ratio != null && (
            <span className="ms-1 text-faint">
              {t("marketing.ofBudget", { budget: formatMinor(budgetMinor) })}
            </span>
          )}
        </span>

        {ratio == null ? (
          <span className="shrink-0 text-2xs text-faint">
            {t("marketing.noBudgetSet")}
          </span>
        ) : (
          /* ⚠️ THE PERCENTAGE STAYS WHEN OVER BUDGET. It used to be REPLACED
             by the badge, so the one state where the magnitude matters most —
             105% over vs 400% over — was the one state that hid it, leaving
             a red bar as the only quantitative signal. The badge is the word;
             the figure is the amount. Both, always. */
          <span className="flex shrink-0 items-center gap-1.5">
            {overBudget && (
              <Badge tone="danger">{t("marketing.overBudget")}</Badge>
            )}
            <span
              className={cn(
                "tnum text-2xs",
                overBudget ? "text-danger" : "text-faint"
              )}
            >
              {Math.round(ratio * 100)}%
            </span>
          </span>
        )}
      </div>

      {ratio != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className={overBudget ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-brand"}
            style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
