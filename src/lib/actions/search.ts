"use server";

import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Global search across the sections a person actually looks things up by name:
 * clients, orders (by code or title), products, collections, supplies,
 * campaigns. One fan-out of small `ilike` queries behind a single action, run
 * only when the palette is opened and typed into — never in a page's wave, so
 * it costs nothing until used.
 *
 * ⚠️ Returns a deep-LINK per hit, built here so the client never hardcodes a
 * route shape. The label carries enough to disambiguate (an order shows its
 * code; a product shows its collection).
 */
export type SearchResultType =
  | "client"
  | "order"
  | "product"
  | "collection"
  | "supply"
  | "campaign";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  /** Secondary line — a collection name, an order code, a category. */
  subtitle: string | null;
  href: string;
};

const PER_TYPE = 5;

export async function globalSearch(query: string): Promise<SearchResult[]> {
  await getSessionContext();
  const q = query.trim();
  // Two characters minimum: a single letter matches half the database and the
  // list is noise. The client also guards this, but the server is the boundary.
  if (q.length < 2) return [];

  const supabase = await createClient();
  // Escape PostgREST `ilike` wildcards so a literal % or _ in the query doesn't
  // silently widen the match.
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [clients, orders, products, collections, supplies, campaigns] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, city")
        .is("archived_at", null)
        .ilike("name", like)
        .limit(PER_TYPE),
      supabase
        .from("orders")
        .select("id, code, title")
        .or(`code.ilike.${like},title.ilike.${like}`)
        .limit(PER_TYPE),
      supabase
        .from("products")
        .select("id, name, collection_id, collections(name)")
        .ilike("name", like)
        .limit(PER_TYPE),
      supabase
        .from("collections")
        .select("id, name")
        .ilike("name", like)
        .limit(PER_TYPE),
      supabase
        .from("supplies")
        .select("id, name, category")
        .is("archived_at", null)
        .ilike("name", like)
        .limit(PER_TYPE),
      supabase
        .from("campaigns")
        .select("id, name")
        .is("archived_at", null)
        .ilike("name", like)
        .limit(PER_TYPE),
    ]);

  const results: SearchResult[] = [];

  for (const c of clients.data ?? []) {
    results.push({
      type: "client",
      id: c.id,
      title: c.name,
      subtitle: (c as { city: string | null }).city,
      href: `/clients/${c.id}`,
    });
  }
  for (const o of orders.data ?? []) {
    const row = o as { id: string; code: string | null; title: string };
    results.push({
      type: "order",
      id: row.id,
      title: row.title || row.code || "—",
      subtitle: row.code,
      href: `/shipping/orders/${row.id}`,
    });
  }
  for (const p of products.data ?? []) {
    const row = p as {
      id: string;
      name: string;
      collection_id: string;
      collections: { name: string }[] | { name: string } | null;
    };
    const coll = Array.isArray(row.collections)
      ? row.collections[0]?.name
      : row.collections?.name;
    results.push({
      type: "product",
      id: row.id,
      title: row.name,
      subtitle: coll ?? null,
      href: `/creative/collections/${row.collection_id}/products/${row.id}`,
    });
  }
  for (const c of collections.data ?? []) {
    results.push({
      type: "collection",
      id: c.id,
      title: (c as { name: string }).name,
      subtitle: null,
      href: `/creative/collections/${c.id}`,
    });
  }
  for (const s of supplies.data ?? []) {
    const row = s as { id: string; name: string; category: string | null };
    results.push({
      type: "supply",
      id: row.id,
      title: row.name,
      subtitle: row.category,
      href: `/equipment/supplies/${row.id}`,
    });
  }
  for (const c of campaigns.data ?? []) {
    results.push({
      type: "campaign",
      id: c.id,
      title: (c as { name: string }).name,
      subtitle: null,
      href: `/marketing/campaigns/${c.id}`,
    });
  }

  return results;
}
