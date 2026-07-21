import { IdeaForm } from "@/components/creative/idea-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function NewIdeaPage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage title={t("creative.newIdea")} description={t("creative.noIdeasHint")}>
      <IdeaForm />
    </CreatePage>
  );
}
