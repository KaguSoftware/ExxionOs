import { Suspense } from "react";

import { CreativePanels } from "@/components/creative/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Collection, Idea, Issue, Product } from "@/lib/types";

/**
 * Creative hub — ONE page, three tabs (Collections · Ideas · Learnings),
 * switched in pure client state.
 *
 * ⚠️ ONE WAVE. Everything below — including data for tabs that aren't visible
 * yet — sits in a SINGLE `Promise.all`. A round-trip costs ~305ms; a query
 * added to an existing wave costs ~3ms. Fetching all three tabs up front is
 * therefore nearly free, and switching between them costs nothing at all.
 */
export default async function CreativePage() {
  await getSessionContext();
  const supabase = await createClient();

  const [collections, ideas, issues, products] = await Promise.all([
    rowsOrThrow<Collection>(
      "creative.collections",
      supabase.from("collections").select("*").order("created_at", { ascending: false })
    ),
    rowsOrThrow<Idea>(
      "creative.ideas",
      supabase.from("ideas").select("*").order("created_at", { ascending: false })
    ),
    // Learnings reads EVERY issue app-wide — that is the whole point of the
    // lens. The collection tab filters this same set client-side.
    rowsOrThrow<Issue>(
      "creative.issues",
      supabase.from("issues").select("*").order("created_at", { ascending: false })
    ),
    // Only what the collection cards need for their product counts, and what
    // Learnings needs to name the product an issue points at. Costing is NOT
    // shown on this page, so materials and rates are deliberately not fetched
    // here — a query you don't render is still a query.
    rowsOrThrow<Product>(
      "creative.products",
      supabase.from("products").select("id, collection_id, name")
    ),
  ]);

  return (
    <>
      <LiveRefresh tables={["collections", "ideas", "issues", "products"]} />
      {/* useSearchParams in the tab shell requires a Suspense boundary. */}
      <Suspense>
        <CreativePanels
          collections={collections}
          ideas={ideas}
          issues={issues}
          products={products}
        />
      </Suspense>
    </>
  );
}
