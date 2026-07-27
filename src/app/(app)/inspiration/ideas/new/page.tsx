import { PinComposer } from "@/components/inspiration/pin-composer";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board, Vocabulary } from "@/lib/types";

/**
 * The TEXT / URL capture surface.
 *
 * ⚠️ No photo field here — pictures arrive by drop, paste or URL, and each of
 * those creates the pin first and attaches second. Uploading against an id that
 * may never be created is how a bucket fills with orphans. Photos are managed
 * on the pin's own page.
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
      descriptionKey="inspiration.noPinsHint"
    >
      <PinComposer
        boards={boards}
        tagVocabulary={tagVocabulary}
        defaultBoardId={board ?? null}
      />
    </CreatePage>
  );
}
