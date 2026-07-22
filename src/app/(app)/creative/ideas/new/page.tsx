import { IdeaForm } from "@/components/creative/idea-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";

export default async function NewIdeaPage() {
  await getSessionContext();

  return (
    <CreatePage titleKey="creative.newIdea" descriptionKey="creative.noIdeasHint">
      <IdeaForm />
    </CreatePage>
  );
}
