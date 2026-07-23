import { notFound } from "next/navigation";

import { MachineForm } from "@/components/equipment/machine-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Machine, Vocabulary } from "@/lib/types";

export default async function EditMachinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const [{ data: machine }, kinds] = await Promise.all([
    selectOrThrow<Machine>(
      "machine.edit",
      supabase.from("machines").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<Vocabulary>(
      "machine.edit.kinds",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "machine_kind")
        .is("archived_at", null)
        .order("sort_order")
    ),
  ]);

  if (!machine) notFound();

  return (
    <CreatePage titleKey="equipment.editMachine">
      <MachineForm existing={machine} kinds={kinds} />
    </CreatePage>
  );
}
