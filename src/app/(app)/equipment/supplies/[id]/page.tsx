import { notFound } from "next/navigation";

import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Supply } from "@/lib/types";

export default async function EditSupplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const { data: supply } = await selectOrThrow<Supply>(
    "supply.edit",
    supabase.from("supplies").select("*").eq("id", id).maybeSingle()
  );

  if (!supply) notFound();

  return (
    <CreatePage titleKey="equipment.editSupply">
      <SupplyForm existing={supply} />
    </CreatePage>
  );
}
