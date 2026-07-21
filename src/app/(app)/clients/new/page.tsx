import { ClientForm } from "@/components/clients/client-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Vocabulary } from "@/lib/types";

/**
 * ⚠️ A dedicated spacious surface, per the convention — never an inline
 * expander in the directory and never a modal. The only thing read up front is
 * the tag vocabulary, so the picker can offer words that already exist.
 */
export default async function NewClientPage() {
  await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  const tagVocabulary = await rowsOrThrow<Vocabulary>(
    "client.new.tags",
    supabase
      .from("vocabularies")
      .select("*")
      .eq("kind", "client_tag")
      .is("archived_at", null)
      .order("sort_order")
  );

  return (
    <CreatePage title={t("clients.newClient")} description={t("clients.subtitle")}>
      <ClientForm tagVocabulary={tagVocabulary} />
    </CreatePage>
  );
}
