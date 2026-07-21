import { notFound } from "next/navigation";

import { MachineDetail } from "@/components/equipment/machine-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Machine, MaintenanceLog, Reminder, Transaction } from "@/lib/types";

export default async function MachinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  // ONE WAVE. Nothing here depends on the machine row's contents.
  const [machineResult, logs, spend, reminders] = await Promise.all([
    selectOrThrow<Machine>(
      "machine.row",
      supabase.from("machines").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<MaintenanceLog>(
      "machine.logs",
      supabase
        .from("maintenance_logs")
        .select("*")
        .eq("machine_id", id)
        .order("performed_on", { ascending: false })
    ),
    // Lifetime cost from FINANCE — the single source of truth for money.
    rowsOrThrow<Pick<Transaction, "amount_minor">>(
      "machine.spend",
      supabase
        .from("transactions")
        .select("amount_minor")
        .eq("source_type", "equipment")
        .eq("source_id", id)
        .eq("direction", "out")
    ),
    // ⚠️ NO NEW TABLE. `reminders` (migration 0001) already carries
    // source_type/source_id, so "service this in 3 months" is just a reminder
    // pointed at this machine — and it shows up in the dashboard strip free.
    rowsOrThrow<Reminder>(
      "machine.reminders",
      supabase
        .from("reminders")
        .select("*")
        .eq("owner_id", ctx.userId)
        .eq("source_type", "machine")
        .eq("source_id", id)
        .is("done_at", null)
        .order("due_on", { ascending: true, nullsFirst: false })
    ),
  ]);

  const machine = machineResult.data;
  if (!machine) notFound();

  const totalSpentMinor = spend.reduce((sum, row) => sum + row.amount_minor, 0);

  return (
    <>
      <LiveRefresh tables={["machines", "maintenance_logs", "reminders"]} />
      <MachineDetail
        machine={machine}
        logs={logs}
        totalSpentMinor={totalSpentMinor}
        reminders={reminders}
      />
    </>
  );
}
