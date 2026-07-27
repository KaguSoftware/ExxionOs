import { notFound } from "next/navigation";

import { BoardForm } from "@/components/inspiration/board-form";
import { CreatePage } from "@/components/ui/create";
import { selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

export default async function EditBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const { data: board } = await selectOrThrow<Board>(
    "board.edit",
    supabase.from("boards").select("*").eq("id", id).maybeSingle()
  );

  if (!board) notFound();

  return (
    <CreatePage titleKey="inspiration.editBoard">
      <BoardForm existing={board} />
    </CreatePage>
  );
}
