import { PricingCalculator } from "@/components/tools/pricing-calculator";
import { PageHeader } from "@/components/ui/panel";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Supply } from "@/lib/types";

/**
 * The pricing calculator — a standalone tool for quoting a custom piece BEFORE
 * it exists in the system. Reuses the same costing math as products.
 */
export default async function PricingToolPage() {
  await getSessionContext();
  const supabase = await createClient();

  // One wave: the costing rates + the printing supplies to price against.
  const [settingsResult, supplies] = await Promise.all([
    selectOrThrow<Pick<AppSettings, "machine_hour_rate_minor" | "labor_hour_rate_minor">>(
      "pricing.settings",
      supabase
        .from("app_settings")
        .select("machine_hour_rate_minor, labor_hour_rate_minor")
        .eq("id", 1)
        .maybeSingle()
    ),
    rowsOrThrow<Supply>(
      "pricing.supplies",
      supabase
        .from("supplies")
        .select("*")
        .is("archived_at", null)
        .not("cost_per_kg_minor", "is", null)
        .order("name")
    ),
  ]);

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader titleKey="tools.pricingTitle" descriptionKey="tools.pricingSubtitle" />
        <PricingCalculator
          supplies={supplies}
          machineRateMinor={settingsResult.data?.machine_hour_rate_minor ?? 0}
          laborRateMinor={settingsResult.data?.labor_hour_rate_minor ?? 0}
        />
      </div>
    </div>
  );
}
