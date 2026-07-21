import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CampaignDetail } from "@/components/marketing/campaign-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignCost, Sample } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

export default async function CampaignPage({
  params,
}: {
  // Next 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE. Nothing here depends on the campaign ROW's contents — only on
   * the id from the URL — so fetching it first would add ~305ms to buy nothing.
   */
  const [campaignResult, costs, samples] = await Promise.all([
    selectOrThrow<Campaign>(
      "campaign.row",
      supabase.from("campaigns").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<CampaignCost>(
      "campaign.costs",
      supabase
        .from("campaign_costs")
        .select("*")
        .eq("campaign_id", id)
        .order("spent_on", { ascending: false })
    ),
    rowsOrThrow<Sample>(
      "campaign.samples",
      supabase
        .from("samples")
        .select("*")
        .eq("campaign_id", id)
        .order("given_on", { ascending: false })
    ),
  ]);

  const campaign = campaignResult.data;
  if (!campaign) notFound();

  return (
    <>
      <LiveRefresh tables={["campaigns", "campaign_costs", "samples"]} />
      <Suspense>
        <CampaignDetail
          campaign={campaign}
          costs={costs}
          samples={samples}
          today={todayInIstanbul()}
        />
      </Suspense>
    </>
  );
}
