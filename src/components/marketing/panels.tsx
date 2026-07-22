"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CampaignList } from "@/components/marketing/campaign-list";
import { MarketingInsights, type MarketingSpendRow } from "@/components/marketing/insights";
import { SampleList, type SampleProductOption } from "@/components/marketing/sample-list";
import { MarketingSchedule } from "@/components/marketing/schedule";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { groupCosts, overBudgetCampaigns } from "@/lib/marketing";
import type {
  Campaign,
  CampaignCost,
  Client,
  Event,
  Supply,
  Product,
  Sample,
} from "@/lib/types";

export function MarketingPanels({
  campaigns,
  costs,
  spend,
  events,
  samples,
  products,
  productOptions,
  supplies,
  machineRateMinor,
  clients,
  taggedOrders,
  orderRevenue,
  today,
}: {
  campaigns: Campaign[];
  costs: CampaignCost[];
  spend: MarketingSpendRow[];
  /** ⚠️ Marketing-kind rows from the SHARED `events` table — a lens, not a copy. */
  events: Event[];
  samples: Sample[];
  products: Product[];
  productOptions: SampleProductOption[];
  supplies: Supply[];
  machineRateMinor: number;
  clients: Client[];
  taggedOrders: { id: string; campaign_id: string | null }[];
  orderRevenue: { order_id: string; amount_minor: number }[];
  /** Stamped on the server — see the call site in `(app)/marketing/page.tsx`. */
  today: string;
}) {
  const { t } = useI18n();

  const costsByCampaign = useMemo(() => groupCosts(costs), [costs]);

  /**
   * The tab badge counts WHAT NEEDS YOU — live campaigns past their budget. A
   * badge counting healthy campaigns would nag about nothing, which is how
   * people learn to ignore badges.
   */
  const needsYou = useMemo(
    () => overBudgetCampaigns(campaigns, costsByCampaign).length,
    [campaigns, costsByCampaign]
  );

  const newCampaignAction = (
    <Link href="/marketing/campaigns/new">
      <Button
        size="sm"
        variant="primary"
        icon={<Plus aria-hidden className="size-3.5" />}
      >
        {t("marketing.newCampaign")}
      </Button>
    </Link>
  );

  return (
    <TabbedPanels
      title={t("marketing.title")}
      description={t("marketing.subtitle")}
      tabs={[
        {
          id: "campaigns",
          label: t("marketing.tabCampaigns"),
          count: needsYou,
          action: newCampaignAction,
          content: (
            <CampaignList campaigns={campaigns} costsByCampaign={costsByCampaign} />
          ),
        },
        {
          id: "schedule",
          label: t("marketing.tabSchedule"),
          content: <MarketingSchedule events={events} today={today} />,
        },
        {
          id: "samples",
          label: t("marketing.tabSamples"),
          content: (
            <SampleList
              samples={samples}
              products={products}
              productOptions={productOptions}
              supplies={supplies}
              machineRateMinor={machineRateMinor}
              clients={clients}
              campaigns={campaigns}
              today={today}
            />
          ),
        },
        {
          id: "insights",
          label: t("marketing.tabInsights"),
          content: (
            <MarketingInsights
              campaigns={campaigns}
              spend={spend}
              samples={samples}
              products={products}
              supplies={supplies}
              machineRateMinor={machineRateMinor}
              clients={clients}
              taggedOrders={taggedOrders}
              orderRevenue={orderRevenue}
            />
          ),
        },
      ]}
    />
  );
}
