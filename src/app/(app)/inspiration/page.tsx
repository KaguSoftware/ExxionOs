import { Suspense } from "react";

import { InspirationPanels } from "@/components/inspiration/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Board, Idea, IdeaImage, Vocabulary } from "@/lib/types";

/**
 * Inspiration — the board. Four tabs (Pins · Boards · List · Tags), switched in
 * pure client state.
 *
 * ⚠️ ONE WAVE. Everything below sits in a SINGLE `Promise.all`. A round-trip
 * costs ~305ms; a query added to an existing wave costs ~3ms — so fetching
 * every tab up front is nearly free, and switching between them costs nothing.
 *
 * ⚠️ THIS PAGE OWNS `ideas`. /creative used to read them; 0025 moved the
 * feature here and Creative's wave dropped the query. Adding one back there
 * would resurrect the coupling.
 */
export default async function InspirationPage() {
  await getSessionContext();
  const supabase = await createClient();

  const [boards, pins, images, tagVocabulary] = await Promise.all([
    rowsOrThrow<Board>(
      "inspiration.boards",
      // Archived boards included — the Boards tab has to show them in order to
      // offer un-archiving, exactly like the vocabulary manager.
      supabase.from("boards").select("*").order("name")
    ),
    rowsOrThrow<Idea>(
      "inspiration.pins",
      supabase.from("ideas").select("*").order("created_at", { ascending: false })
    ),
    // ⚠️ THE WHOLE TABLE, grouped by pin in the component. A query per pin
    // would be forty round-trips for a wall that renders in one, and these
    // rows are tiny — a path and two integers.
    rowsOrThrow<IdeaImage>(
      "inspiration.images",
      supabase
        .from("idea_images")
        .select("id, idea_id, path, sort_order, width, height")
        .order("sort_order")
    ),
    // ALL tags including archived — the manager tab needs them to un-archive.
    rowsOrThrow<Vocabulary>(
      "inspiration.tags",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "idea_tag")
        .order("sort_order")
    ),
  ]);

  return (
    <>
      <LiveRefresh tables={["ideas", "idea_images", "boards", "vocabularies"]} />
      {/* useSearchParams in the tab shell requires a Suspense boundary. */}
      <Suspense>
        <InspirationPanels
          pins={pins}
          images={images}
          boards={boards}
          tagVocabulary={tagVocabulary}
        />
      </Suspense>
    </>
  );
}
