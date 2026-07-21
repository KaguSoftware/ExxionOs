import { CreatePage } from "@/components/ui/create";
import { OrderForm, type ProductOption } from "@/components/shipping/order-form";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

/**
 * ⚠️ An embedded relation is typed as an ARRAY by the Supabase client even
 * when the FK guarantees at most one row. Declaring it as an object compiles
 * against a lie and then reads `undefined` at runtime — normalise instead.
 */
type ProductRow = {
  id: string;
  name: string;
  price_minor: number | null;
  collections: { name: string }[] | { name: string } | null;
};

function collectionName(row: ProductRow): string {
  const c = row.collections;
  if (!c) return "";
  return Array.isArray(c) ? (c[0]?.name ?? "") : c.name;
}

export default async function NewOrderPage() {
  await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  // One wave: the clients an order can belong to, and the products a line can
  // point at — the link that makes per-collection P&L possible.
  const [clients, products] = await Promise.all([
    rowsOrThrow<Client>(
      "newOrder.clients",
      supabase.from("clients").select("*").is("archived_at", null).order("name")
    ),
    rowsOrThrow<ProductRow>(
      "newOrder.products",
      supabase
        .from("products")
        .select("id, name, price_minor, collections(name)")
        .order("name")
    ),
  ]);

  const options: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    collectionName: collectionName(p),
    priceMinor: p.price_minor,
  }));

  return (
    <CreatePage
      title={t("shipping.newOrder")}
      description={t("shipping.newOrderSubtitle")}
      wide
    >
      <OrderForm clients={clients} products={options} />
    </CreatePage>
  );
}
