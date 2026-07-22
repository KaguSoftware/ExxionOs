import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Vocabulary } from "@/lib/types";

export default async function NewSupplyPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [categories, items] = await Promise.all([
    rowsOrThrow<{ name: string }>(
      "supply.new.categories",
      supabase
        .from("categories")
        .select("name")
        .eq("kind", "expense")
        .is("archived_at", null)
        .order("sort_order")
    ),
    rowsOrThrow<Vocabulary>(
      "supply.new.items",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "supply_item")
        .is("archived_at", null)
        .order("sort_order")
    ),
  ]);

  return (
    <CreatePage
      titleKey="equipment.newSupply"
      descriptionKey="equipment.newSupplyHint"
    >
      <SupplyForm categories={categories.map((c) => c.name)} items={items} />
    </CreatePage>
  );
}
