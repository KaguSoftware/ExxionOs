import { SupplyForm } from "@/components/equipment/supply-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function NewSupplyPage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage
      title={t("equipment.newSupply")}
      description={t("equipment.noSuppliesHint")}
    >
      <SupplyForm />
    </CreatePage>
  );
}
