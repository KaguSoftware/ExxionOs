import { Suspense } from "react";

import type { MarketingSpendRow } from "@/components/marketing/insights";
import { MarketingPanels } from "@/components/marketing/panels";
import type { SampleProductOption } from "@/components/marketing/sample-list";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { MARKETING_KINDS } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";
import type {
  Campaign,
  CampaignCost,
  Client,
  Event,
  Product,
  Sample,
  Supply,
} from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * ⚠️ An embedded relation is typed as an ARRAY by the Supabase client even when
 * the FK guarantees at most one row. Declaring it as an object compiles against
 * a lie and reads `undefined` at runtime — normalise instead. Same note as
 * `shipping/orders/new/page.tsx`.
 */
type ProductRow = Product & {
  collections: { name: string }[] | { name: string } | null;
};

function collectionName(row: ProductRow): string {
  const c = row.collections;
  if (!c) return "";
  return Array.isArray(c) ? (c[0]?.name ?? "") : c.name;
}

/**
 * Marketing — ONE page, four tabs, switched in pure client state.
 *
 * ⚠️ ONE WAVE, including the data for tabs nobody has clicked yet. A
 * round-trip is ~305ms; a query added to this `Promise.all` costs ~3ms.
 */
export default async function MarketingPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [campaigns, costs, spend, events, samples, productRows, supplies, settings, clients] =
    await Promise.all([
      rowsOrThrow<Campaign>(
        "marketing.campaigns",
        supabase.from("campaigns").select("*").order("created_at", { ascending: false })
      ),
      rowsOrThrow<CampaignCost>(
        "marketing.costs",
        supabase.from("campaign_costs").select("*").order("spent_on", { ascending: false })
      ),
      /**
       * ⚠️ WHAT WAS ACTUALLY SPENT — read from Finance, never by summing
       * `campaigns.budget_minor` (the PLAN) and never by adding the two, which
       * reports roughly double. Same rule as machine spend (Phase 4) and order
       * revenue (Phase 5). `source_id` is the campaign.
       */
      rowsOrThrow<MarketingSpendRow>(
        "marketing.spend",
        supabase
          .from("transactions")
          .select("source_id, direction, amount_minor, occurred_on")
          .eq("source_type", "marketing")
      ),
      /**
       * ⚠️ THE LENS. These are rows of the SHARED `events` table (0009),
       * filtered by kind — the Clients timeline reads the same table. Nothing
       * is copied, so nothing can drift.
       */
      rowsOrThrow<Event>(
        "marketing.events",
        supabase
          .from("events")
          .select("*")
          .in("kind", MARKETING_KINDS)
          .order("occurred_on", { ascending: false })
          .limit(500)
      ),
      rowsOrThrow<Sample>(
        "marketing.samples",
        supabase.from("samples").select("*").order("given_on", { ascending: false }).limit(500)
      ),
      // Products + supplies + the machine rate are what make a sample
      // COSTABLE. Cost is computed at read time, never stored (Phase 3).
      rowsOrThrow<ProductRow>(
        "marketing.products",
        supabase.from("products").select("*, collections(name)").order("name")
      ),
      rowsOrThrow<Supply>(
        "marketing.supplies",
        supabase.from("supplies").select("*").order("name")
      ),
      selectOrThrow<{ machine_hour_rate_minor: number }>(
        "marketing.settings",
        supabase
          .from("app_settings")
          .select("machine_hour_rate_minor")
          .eq("id", 1)
          .maybeSingle()
      ),
      // Powers the honest "where new clients came from" signal on Insights.
      rowsOrThrow<Client>(
        "marketing.clients",
        supabase.from("clients").select("*").order("created_at")
      ),
    ]);

  const productOptions: SampleProductOption[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    collectionName: collectionName(p),
  }));

  return (
    <>
      <LiveRefresh tables={["campaigns", "campaign_costs", "samples", "events"]} />
      <Suspense>
        <MarketingPanels
          campaigns={campaigns}
          costs={costs}
          spend={spend}
          events={events}
          samples={samples}
          products={productRows}
          productOptions={productOptions}
          supplies={supplies}
          machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
          clients={clients}
          /**
           * ⚠️ Stamped once on the server. The schedule splits upcoming from
           * past against this date, and `react-hooks/purity` is an error here
           * so it can never be re-read from the clock mid-render.
           * `todayInIstanbul()` is the app's one correct today — a UTC clock
           * answers YESTERDAY between 00:00 and 03:00 local.
           */
          today={todayInIstanbul()}
        />
      </Suspense>
    </>
  );
}
