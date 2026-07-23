import { MachineForm } from "@/components/equipment/machine-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Vocabulary } from "@/lib/types";

export default async function NewMachinePage() {
  await getSessionContext();
  const supabase = await createClient();

  const kinds = await rowsOrThrow<Vocabulary>(
    "machine.new.kinds",
    supabase
      .from("vocabularies")
      .select("*")
      .eq("kind", "machine_kind")
      .is("archived_at", null)
      .order("sort_order")
  );

  return (
    <CreatePage
      titleKey="equipment.newMachine"
      descriptionKey="equipment.noMachinesHint"
    >
      <MachineForm kinds={kinds} />
    </CreatePage>
  );
}
