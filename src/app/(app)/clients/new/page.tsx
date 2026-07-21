import { ClientForm } from "@/components/clients/client-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

/**
 * ⚠️ A dedicated spacious surface, per the convention — never an inline
 * expander in the directory and never a modal. No data wave is needed: a new
 * client depends on nothing that already exists.
 */
export default async function NewClientPage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage title={t("clients.newClient")} description={t("clients.subtitle")}>
      <ClientForm />
    </CreatePage>
  );
}
