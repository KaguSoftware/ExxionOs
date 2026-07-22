import { ProductForm } from "@/components/creative/product-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Material, Vocabulary } from "@/lib/types";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  const [materials, settings, productTypes] = await Promise.all([
    rowsOrThrow<Material>(
      "product.new.materials",
      supabase.from("materials").select("*").is("archived_at", null).order("name")
    ),
    selectOrThrow<AppSettings>(
      "product.new.settings",
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    ),
    rowsOrThrow<Vocabulary>(
      "product.new.types",
      supabase
        .from("vocabularies")
        .select("*")
        .eq("kind", "product_type")
        .is("archived_at", null)
        .order("sort_order")
    ),
  ]);

  return (
    <CreatePage titleKey="creative.newProduct">
      <ProductForm
        collectionId={id}
        materials={materials}
        machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
        productTypes={productTypes}
      />
    </CreatePage>
  );
}
