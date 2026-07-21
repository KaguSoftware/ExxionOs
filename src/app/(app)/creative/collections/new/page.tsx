import { CollectionForm } from "@/components/creative/collection-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function NewCollectionPage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage
      title={t("creative.newCollection")}
      description={t("creative.noCollectionsHint")}
    >
      <CollectionForm />
    </CreatePage>
  );
}
