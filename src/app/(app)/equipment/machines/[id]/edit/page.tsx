import { notFound } from "next/navigation";

import { MachineForm } from "@/components/equipment/machine-form";
import { CreatePage } from "@/components/ui/create";
import { selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Machine } from "@/lib/types";

export default async function EditMachinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const { data: machine } = await selectOrThrow<Machine>(
    "machine.edit",
    supabase.from("machines").select("*").eq("id", id).maybeSingle()
  );

  if (!machine) notFound();

  return (
    <CreatePage titleKey="equipment.editMachine">
      <MachineForm existing={machine} />
    </CreatePage>
  );
}
