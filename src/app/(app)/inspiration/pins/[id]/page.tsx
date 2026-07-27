import { notFound } from "next/navigation";

import { PinDetail } from "@/components/inspiration/pin-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board, Idea, IdeaImage, Vocabulary } from "@/lib/types";

/** One pin, opened. ONE wave. */
export default async function PinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const [pinResult, images, boards, tagVocabulary] = await Promise.all([
    selectOrThrow<Idea>(
      "pin.detail",
      supabase.from("ideas").select("*").eq("id", id).maybeSingle()
    ),
    rowsOrThrow<IdeaImage>(
      "pin.images",
      supabase
        .from("idea_images")
        .select("id, idea_id, path, sort_order, width, height")
        .eq("idea_id", id)
        .order("sort_order")
    ),
    rowsOrThrow<Board>(
      "pin.boards",
      supabase.from("boards").select("*").order("name")
    ),
    rowsOrThrow<Vocabulary>(
      "pin.tags",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "idea_tag")
        .order("sort_order")
    ),
  ]);

  const pin = pinResult.data;
  if (!pin) notFound();

  // A second round-trip only for a promoted pin — the overwhelmingly common
  // case is an un-promoted one, which pays nothing. Putting it in the wave
  // above would mean fetching a collection for every pin that has none.
  let collectionName: string | null = null;
  if (pin.collection_id) {
    const { data } = await selectOrThrow<{ name: string }>(
      "pin.collection",
      supabase
        .from("collections")
        .select("name")
        .eq("id", pin.collection_id)
        .maybeSingle()
    );
    collectionName = data?.name ?? null;
  }

  return (
    <>
      <LiveRefresh tables={["ideas", "idea_images"]} />
      <PinDetail
        pin={pin}
        images={images}
        boards={boards}
        tagVocabulary={tagVocabulary}
        collectionName={collectionName}
      />
    </>
  );
}
