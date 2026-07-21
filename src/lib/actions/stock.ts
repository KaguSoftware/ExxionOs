"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { appendMovement, sumDelta } from "@/lib/stock-write";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/**
 * Manual stock corrections. The automatic movements (print runs, orders,
 * samples) are written by their own sections through `lib/stock-write.ts`.
 */

/**
 * "I counted the shelf, it's actually N."
 *
 * ⚠️ WRITES THE DIFFERENCE, NOT THE TOTAL. On-hand is `sum(delta)`, so a
 * correction has to be the gap between what the ledger says and what the shelf
 * says. Writing N itself would double the count. This is the same shape
 * `adjustSupplyQuantity` uses in Equipment.
 *
 * ⚠️ `source_id` is deliberately null, which means corrections are the one
 * reason NOT covered by the idempotency index — counting the same shelf twice
 * in a day is legitimate and must not be blocked.
 */
export async function correctProductStock(input: {
  productId: string;
  /** The physically counted number of units. */
  countedUnits: number;
  note?: string | null;
}): Promise<ActionResult<{ delta: number }>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const counted = Math.max(0, Math.round(input.countedUnits));

  const { data: rows, error: readError } = await supabase
    .from("product_stock_movements")
    .select("delta")
    .eq("product_id", input.productId);

  if (readError) return { ok: false, error: readError.message };

  const current = sumDelta((rows ?? []) as { delta: number }[]);
  const delta = counted - current;

  // Already correct — say so rather than writing a zero row the check
  // constraint would reject anyway.
  if (delta === 0) return { ok: true, data: { delta: 0 } };

  const result = await appendMovement(supabase, ctx.userId, {
    productId: input.productId,
    delta,
    reason: "correction",
    note: input.note,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const { data: product } = await supabase
    .from("products")
    .select("collection_id")
    .eq("id", input.productId)
    .maybeSingle<{ collection_id: string }>();

  revalidatePath("/creative");
  if (product) revalidatePath(`/creative/collections/${product.collection_id}`);
  revalidatePath("/");

  return { ok: true, data: { delta } };
}
