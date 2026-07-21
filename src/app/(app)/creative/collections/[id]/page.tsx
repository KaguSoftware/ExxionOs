import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CollectionDetail } from "@/components/creative/collection-detail";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  Collection,
  Issue,
  Material,
  Product,
  StoredImage,
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
   * ⚠️ ONE WAVE, including both tabs' data. The collection row itself is
   * fetched alongside everything else rather than first — nothing here depends
   * on its contents, only on the id from the URL, so making it sequential
   * would add ~305ms to buy nothing.
   */
  const [collectionResult, products, issues, materials, settings, images] =
    await Promise.all([
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
      rowsOrThrow<Material>(
        "collection.materials",
        supabase.from("materials").select("*").order("name")
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
    ]);

  const collection = collectionResult.data;
  if (!collection) notFound();

  return (
    <>
      <LiveRefresh tables={["products", "issues", "collections"]} />
      <Suspense>
        <CollectionDetail
          collection={collection}
          products={products}
          issues={issues}
          materials={materials}
          machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
          images={images}
        />
      </Suspense>
    </>
  );
}
