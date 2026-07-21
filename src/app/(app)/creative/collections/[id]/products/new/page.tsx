import { ProductForm } from "@/components/creative/product-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Material } from "@/lib/types";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  const [materials, settings] = await Promise.all([
    rowsOrThrow<Material>(
      "product.new.materials",
      supabase.from("materials").select("*").is("archived_at", null).order("name")
    ),
    selectOrThrow<AppSettings>(
      "product.new.settings",
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    ),
  ]);

  return (
    <CreatePage title={t("creative.newProduct")}>
      <ProductForm
        collectionId={id}
        materials={materials}
        machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
      />
    </CreatePage>
  );
}
