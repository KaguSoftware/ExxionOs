import { MachineForm } from "@/components/equipment/machine-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";

export default async function NewMachinePage() {
  await getSessionContext();

  return (
    <CreatePage
      titleKey="equipment.newMachine"
      descriptionKey="equipment.noMachinesHint"
    >
      <MachineForm />
    </CreatePage>
  );
}
