import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CollectionDetail } from "@/components/creative/collection-detail";
import type { SoldLine } from "@/components/creative/collection-pnl";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  Collection,
  Issue,
  Product,
  ProductFile,
  ProductStockMovement,
  StoredImage,
  Supply,
} from "@/lib/types";

export default async function CollectionPage({
  params,
}: {
  // Next 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE, including every tab's data. The collection row itself is
   * fetched alongside everything else rather than first — nothing here depends
   * on its contents, only on the id from the URL, so making it sequential
   * would add ~305ms to buy nothing.
   */
  const [
    collectionResult,
    products,
    issues,
    settings,
    images,
    files,
    supplies,
    soldLines,
    stockMovements,
  ] = await Promise.all([
      selectOrThrow<Collection>(
        "collection.row",
        supabase.from("collections").select("*").eq("id", id).maybeSingle()
      ),
      rowsOrThrow<Product>(
        "collection.products",
        supabase
          .from("products")
          .select("*")
          .eq("collection_id", id)
          .order("created_at")
      ),
      // This collection's issues — the SAME rows Learnings shows, filtered.
      rowsOrThrow<Issue>(
        "collection.issues",
        supabase
          .from("issues")
          .select("*")
          .eq("collection_id", id)
          .order("created_at", { ascending: false })
      ),
      selectOrThrow<AppSettings>(
        "collection.settings",
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      ),
      rowsOrThrow<StoredImage & { product_id: string }>(
        "collection.images",
        supabase
          .from("product_images")
          .select("id, path, sort_order, product_id")
          .order("sort_order")
      ),
      // Source/design files per product (.mb/.ma/.stl). Newest first; the panel
      // picks each product's own by id, same shape as images above.
      rowsOrThrow<ProductFile>(
        "collection.files",
        supabase
          .from("product_files")
          .select("*")
          .order("created_at", { ascending: false })
      ),
      // Prices the products AND names the stock a print run draws from. ALL
      // supplies (not just active) — a product may point at one archived since,
      // and dropping it would silently uncost that product.
      rowsOrThrow<Supply>(
        "collection.supplies",
        supabase.from("supplies").select("*").order("name")
      ),
      /**
       * Phase 5: what has actually SOLD, for the P&L tab. Inside the existing
       * wave — ~3ms, not a second round-trip.
       *
       * ⚠️ Every order line in the database is fetched and filtered to this
       * collection's products in the component, because PostgREST cannot filter
       * a child table by a grandparent's column in one request. The alternative
       * is a second round-trip; at this scale the filter is free.
       */
      rowsOrThrow<SoldLine>(
        "collection.soldLines",
        supabase
          .from("order_lines")
          .select("product_id, quantity, unit_price_minor")
          .not("product_id", "is", null)
      ),
      // On-hand for the product cards. Same wave, and the same reason the
      // whole table is read: on-hand is `sum(delta)`, so a partial read is a
      // wrong number that still looks like an answer.
      rowsOrThrow<ProductStockMovement>(
        "collection.stockMovements",
        supabase.from("product_stock_movements").select("*")
      ),
    ]);

  const collection = collectionResult.data;
  if (!collection) notFound();

  return (
    <>
      <LiveRefresh
        tables={[
          "products",
          "issues",
          "collections",
          "product_stock_movements",
          "product_files",
        ]}
      />
      <Suspense>
        <CollectionDetail
          collection={collection}
          products={products}
          issues={issues}
          machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
          images={images}
          files={files}
          supplies={supplies}
          soldLines={soldLines}
          stockMovements={stockMovements}
        />
      </Suspense>
    </>
  );
}
