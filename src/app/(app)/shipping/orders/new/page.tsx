import { CreatePage } from "@/components/ui/create";
import {
  OrderForm,
  type CampaignOption,
  type ProductOption,
} from "@/components/shipping/order-form";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { nextOrderCode } from "@/lib/actions/shipping";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, Client } from "@/lib/types";

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
  const supabase = await createClient();

  // One wave: the clients an order can belong to, the products a line can point
  // at (the link that makes per-collection P&L possible), the live campaigns it
  // can be attributed to, and the next suggested code from the sequence (0018).
  const [clients, products, campaigns, suggestedCode] = await Promise.all([
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
    rowsOrThrow<Pick<Campaign, "id" | "name">>(
      "newOrder.campaigns",
      supabase
        .from("campaigns")
        .select("id, name")
        .is("archived_at", null)
        .order("name")
    ),
    nextOrderCode(),
  ]);

  const campaignOptions: CampaignOption[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const options: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    collectionName: collectionName(p),
    priceMinor: p.price_minor,
  }));

  return (
    <CreatePage
      titleKey="shipping.newOrder"
      descriptionKey="shipping.newOrderSubtitle"
      wide
    >
      <OrderForm
        clients={clients}
        products={options}
        campaigns={campaignOptions}
        suggestedCode={suggestedCode}
      />
    </CreatePage>
  );
}
