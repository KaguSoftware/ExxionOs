import { PinComposer } from "@/components/inspiration/pin-composer";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board, Vocabulary } from "@/lib/types";

/**
 * The full composer: pictures, a link, or just words.
 *
 * ⚠️ Pictures are STAGED IN MEMORY and uploaded in the submit, once the row
 * has a real id — see `image-picker.tsx`. That keeps the standing rule (never
 * write to the bucket against an id that might not exist) without the version
 * of this page that shipped first, which described dropping a picture here and
 * then offered no way to do it.
 *
 * `?board=` pre-selects the board you came from, so "New pin" on a board page
 * doesn't make you pick it again.
 */
export default async function NewPinPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board } = await searchParams;
  await getSessionContext();
  const supabase = await createClient();

  const [boards, tagVocabulary] = await Promise.all([
    rowsOrThrow<Board>(
      "newPin.boards",
      supabase.from("boards").select("*").order("name")
    ),
    rowsOrThrow<Vocabulary>(
      "newPin.tags",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "idea_tag")
        .order("sort_order")
    ),
  ]);

  return (
    <CreatePage
      titleKey="inspiration.newPin"
      descriptionKey="inspiration.newPinHint"
    >
      <PinComposer
        boards={boards}
        tagVocabulary={tagVocabulary}
        defaultBoardId={board ?? null}
      />
    </CreatePage>
  );
}
