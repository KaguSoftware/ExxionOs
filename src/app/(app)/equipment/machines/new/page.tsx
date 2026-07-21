import { MachineForm } from "@/components/equipment/machine-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function NewMachinePage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage
      title={t("equipment.newMachine")}
      description={t("equipment.noMachinesHint")}
    >
      <MachineForm />
    </CreatePage>
  );
}
