import { Suspense } from "react";

import { CreativePanels } from "@/components/creative/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Collection,
  Idea,
  Issue,
  PrintRun,
  Product,
  ProductStockMovement,
  Vocabulary,
} from "@/lib/types";

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

  const [
    collections,
    ideas,
    issues,
    products,
    productTypes,
    stockMovements,
    printRuns,
  ] = await Promise.all([
      rowsOrThrow<Collection>(
        "creative.collections",
        supabase
          .from("collections")
          .select("*")
          .order("created_at", { ascending: false })
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
      // The Stock tab reads these too, so `name` and `collection_id` already
      // cover it — a stock row needs nothing the collection cards don't.
      rowsOrThrow<Product>(
        "creative.products",
        supabase.from("products").select("id, collection_id, name")
      ),
      // ALL types including archived — the manager tab has to show archived
      // rows in order to offer un-archiving them.
      rowsOrThrow<Vocabulary>(
        "creative.productTypes",
        supabase
          .from("vocabularies")
          .select("*")
          .eq("kind", "product_type")
          .order("sort_order")
      ),
      // ⚠️ THE WHOLE LEDGER, because on-hand is `sum(delta)` and a partial
      // read would be a partial sum — i.e. a wrong number that still looks
      // like an answer. With two people and a few dozen designs this is a
      // small table; if it ever isn't, the fix is a database-side aggregate,
      // not a truncated fetch here.
      rowsOrThrow<ProductStockMovement>(
        "creative.stockMovements",
        supabase
          .from("product_stock_movements")
          .select("*")
          .order("created_at", { ascending: false })
      ),
      // ⚠️ The first read of `print_runs` in the app's life — it has been
      // write-only since 0007. Expanding a stock row shows these.
      rowsOrThrow<PrintRun>(
        "creative.printRuns",
        supabase
          .from("print_runs")
          .select("*")
          .order("printed_on", { ascending: false })
      ),
    ]);

  return (
    <>
      <LiveRefresh
        tables={[
          "collections",
          "ideas",
          "issues",
          "products",
          "vocabularies",
          // Shipping an order or logging a giveaway moves stock from ANOTHER
          // section, so this page has to hear about it.
          "product_stock_movements",
          "print_runs",
        ]}
      />
      {/* useSearchParams in the tab shell requires a Suspense boundary. */}
      <Suspense>
        <CreativePanels
          collections={collections}
          ideas={ideas}
          issues={issues}
          products={products}
          productTypes={productTypes}
          stockMovements={stockMovements}
          printRuns={printRuns}
        />
      </Suspense>
    </>
  );
}
