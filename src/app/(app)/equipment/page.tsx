import { Suspense } from "react";

import { EquipmentPanels } from "@/components/equipment/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Machine, MaintenanceLog, Supply, Transaction } from "@/lib/types";

/**
 * Equipment — ONE page, three tabs, switched in pure client state.
 *
 * ⚠️ ONE WAVE, including data for tabs that aren't visible yet. ~305ms per
 * round-trip vs ~3ms inside an existing `Promise.all`.
 */
export default async function EquipmentPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [machines, logs, supplies, spend] = await Promise.all([
    rowsOrThrow<Machine>(
      "equipment.machines",
      supabase.from("machines").select("*").order("name")
    ),
    rowsOrThrow<MaintenanceLog>(
      "equipment.logs",
      supabase
        .from("maintenance_logs")
        .select("*")
        .order("performed_on", { ascending: false })
        .limit(500)
    ),
    rowsOrThrow<Supply>(
      "equipment.supplies",
      supabase.from("supplies").select("*").is("archived_at", null).order("name")
    ),
    /**
     * ⚠️ "Spent on this machine" comes from FINANCE, not from summing
     * `maintenance_logs.cost_minor`. The transaction is the single source of
     * truth for money: summing the logs separately would double-count against
     * Finance and drift the instant someone edits a transaction there.
     */
    rowsOrThrow<Pick<Transaction, "source_id" | "amount_minor">>(
      "equipment.spend",
      supabase
        .from("transactions")
        .select("source_id, amount_minor")
        .eq("source_type", "equipment")
        .eq("direction", "out")
    ),
  ]);

  // Fold to a per-machine total once, on the server.
  const spendByMachine: Record<string, number> = {};
  for (const row of spend) {
    if (!row.source_id) continue;
    spendByMachine[row.source_id] =
      (spendByMachine[row.source_id] ?? 0) + row.amount_minor;
  }

  return (
    <>
      <LiveRefresh
        tables={["machines", "maintenance_logs", "supplies", "transactions"]}
      />
      <Suspense>
        <EquipmentPanels
          machines={machines}
          logs={logs}
          supplies={supplies}
          spendByMachine={spendByMachine}
        />
      </Suspense>
    </>
  );
}
