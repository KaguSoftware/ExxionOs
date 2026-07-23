import { notFound } from "next/navigation";

import { SupplyDetail } from "@/components/equipment/supply-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Supply, SupplyRestock } from "@/lib/types";

export default async function SupplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  // ONE WAVE. Nothing here depends on the supply row's contents.
  const [supplyResult, restocks] = await Promise.all([
    selectOrThrow<Supply>(
      "supply.row",
      supabase.from("supplies").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<SupplyRestock>(
      "supply.restocks",
      supabase
        .from("supply_restocks")
        .select("*")
        .eq("supply_id", id)
        .order("restocked_on", { ascending: false })
    ),
  ]);

  const supply = supplyResult.data;
  if (!supply) notFound();

  return (
    <>
      <LiveRefresh tables={["supplies", "supply_restocks"]} />
      <SupplyDetail supply={supply} restocks={restocks} />
    </>
  );
}
