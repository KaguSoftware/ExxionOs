import { CollectionForm } from "@/components/creative/collection-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";

export default async function NewCollectionPage() {
  await getSessionContext();

  return (
    <CreatePage
      titleKey="creative.newCollection"
      descriptionKey="creative.noCollectionsHint"
    >
      <CollectionForm />
    </CreatePage>
  );
}
