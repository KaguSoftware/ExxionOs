import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BoardDetail } from "@/components/inspiration/board-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board, Idea, IdeaImage } from "@/lib/types";

/** One board's wall. ONE wave, same economics as the section root. */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const [boardResult, pins, images, boards] = await Promise.all([
    selectOrThrow<Board>(
      "board.detail",
      supabase.from("boards").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<Idea>(
      "board.pins",
      supabase
        .from("ideas")
        .select("*")
        .eq("board_id", id)
        .order("created_at", { ascending: false })
    ),
    // Only this board's pictures. Unlike the section root there is no need for
    // the whole table here, and the filter is one indexed join away.
    rowsOrThrow<IdeaImage>(
      "board.images",
      supabase
        .from("idea_images")
        .select("id, idea_id, path, sort_order, width, height, ideas!inner(board_id)")
        .eq("ideas.board_id", id)
        .order("sort_order")
    ),
    // Every board, for the "move to board" picker on the pins below.
    rowsOrThrow<Board>(
      "board.all",
      supabase.from("boards").select("*").order("name")
    ),
  ]);

  const board = boardResult.data;
  if (!board) notFound();

  return (
    <>
      <LiveRefresh tables={["ideas", "idea_images", "boards"]} />
      {/* The wall reads its filters from the URL, so it calls
          `useSearchParams` and needs a boundary. */}
      <Suspense>
        <BoardDetail board={board} pins={pins} images={images} boards={boards} />
      </Suspense>
    </>
  );
}
