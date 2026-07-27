import { BoardForm } from "@/components/inspiration/board-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";

export default async function NewBoardPage() {
  await getSessionContext();

  return (
    <CreatePage
      titleKey="inspiration.newBoard"
      descriptionKey="inspiration.noBoardsHint"
    >
      <BoardForm />
    </CreatePage>
  );
}
