import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";

export default async function NewSupplyPage() {
  await getSessionContext();

  return (
    <CreatePage
      titleKey="equipment.newSupply"
      descriptionKey="equipment.noSuppliesHint"
    >
      <SupplyForm />
    </CreatePage>
  );
}
