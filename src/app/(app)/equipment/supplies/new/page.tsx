import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Vocabulary } from "@/lib/types";

export default async function NewSupplyPage() {
  await getSessionContext();
  const supabase = await createClient();

  const supplyTypes = await rowsOrThrow<Vocabulary>(
    "supply.new.types",
    supabase
      .from("vocabularies")
      .select("*")
      .eq("kind", "supply_type")
      .is("archived_at", null)
      .order("sort_order")
  );

  return (
    <CreatePage
      titleKey="equipment.newSupply"
      descriptionKey="equipment.noSuppliesHint"
    >
      <SupplyForm supplyTypes={supplyTypes} />
    </CreatePage>
  );
}
