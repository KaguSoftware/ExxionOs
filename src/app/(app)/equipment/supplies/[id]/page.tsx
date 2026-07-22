import { notFound } from "next/navigation";

import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Supply, Vocabulary } from "@/lib/types";

export default async function EditSupplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  // One wave — nothing here depends on the supply row's contents.
  const [supplyResult, categories, items] = await Promise.all([
    selectOrThrow<Supply>(
      "supply.edit",
      supabase.from("supplies").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<{ name: string }>(
      "supply.edit.categories",
      supabase
        .from("categories")
        .select("name")
        .eq("kind", "expense")
        .is("archived_at", null)
        .order("sort_order")
    ),
    // ⚠️ ALL items, not just active — this supply may carry a word archived
    // since, and `vocabOptions` keeps it visible so saving can't blank it.
    rowsOrThrow<Vocabulary>(
      "supply.edit.items",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "supply_item")
        .order("sort_order")
    ),
  ]);

  const supply = supplyResult.data;
  if (!supply) notFound();

  return (
    <CreatePage titleKey="equipment.editSupply">
      <SupplyForm
        existing={supply}
        categories={categories.map((c) => c.name)}
        items={items}
      />
    </CreatePage>
  );
}
