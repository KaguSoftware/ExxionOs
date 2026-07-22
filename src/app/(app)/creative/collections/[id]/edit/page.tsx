import { notFound } from "next/navigation";

import { CollectionForm } from "@/components/creative/collection-form";
import { CreatePage } from "@/components/ui/create";
import { selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Collection } from "@/lib/types";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const { data: collection } = await selectOrThrow<Collection>(
    "collection.edit",
    supabase.from("collections").select("*").eq("id", id).maybeSingle()
  );

  if (!collection) notFound();

  return (
    <CreatePage titleKey="creative.editCollection">
      <CollectionForm existing={collection} />
    </CreatePage>
  );
}
