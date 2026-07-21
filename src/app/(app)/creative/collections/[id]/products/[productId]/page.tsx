import { notFound } from "next/navigation";

import { ProductForm } from "@/components/creative/product-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  Material,
  Product,
  StoredImage,
  Vocabulary,
} from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}) {
  const { id, productId } = await params;
  await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  // One wave — nothing here depends on the product row's contents.
  const [productResult, materials, settings, images, productTypes] =
    await Promise.all([
      selectOrThrow<Product>(
        "product.edit",
        supabase.from("products").select("*").eq("id", productId).maybeSingle()
      ),
      // ⚠️ ALL materials, not just active — an existing product may use an
      // archived one, and the form keeps it visible so saving can't silently
      // blank the material and re-cost the product.
      rowsOrThrow<Material>(
        "product.edit.materials",
        supabase.from("materials").select("*").order("name")
      ),
      selectOrThrow<AppSettings>(
        "product.edit.settings",
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      ),
      rowsOrThrow<StoredImage>(
        "product.edit.images",
        supabase
          .from("product_images")
          .select("id, path, sort_order")
          .eq("product_id", productId)
          .order("sort_order")
      ),
      // ⚠️ ALL types, for the same reason as materials above — this product
      // may carry a word that was archived since, and `vocabOptions` keeps it
      // visible so saving can't silently blank the type.
      rowsOrThrow<Vocabulary>(
        "product.edit.types",
        supabase
          .from("vocabularies")
          .select("*")
          .eq("kind", "product_type")
          .order("sort_order")
      ),
    ]);

  const product = productResult.data;
  if (!product) notFound();

  return (
    <CreatePage title={t("creative.editProduct")}>
      <ProductForm
        collectionId={id}
        materials={materials}
        machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
        existing={product}
        images={images}
        productTypes={productTypes}
      />
    </CreatePage>
  );
}
