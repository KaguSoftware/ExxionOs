import type { SupabaseClient } from "@supabase/supabase-js";

import type { StockReason } from "@/lib/types";

/**
 * The one writer into `product_stock_movements`.
 *
 * ⚠️ EVERY section that moves finished units comes through here — Creative
 * (print runs), Shipping (orders), Marketing (samples), and the manual count.
 * Four hand-rolled inserts would be four chances to forget the idempotency
 * key, and the whole point of 0012's partial unique index is that a
 * double-drag on the board cannot deduct twice.
 *
 * ⚠️ NOT a server action, deliberately. It takes the caller's `SupabaseClient`
 * so a transition that has already read the order doesn't pay for a second
 * connection — and a `"use server"` file may only export async functions with
 * serialisable arguments, which a client object is not. The server actions in
 * `actions/stock.ts` wrap this.
 */

/** Postgres unique-violation. See `product_stock_movements_once_idx`. */
const UNIQUE_VIOLATION = "23505";

export type MovementInput = {
  productId: string;
  /** Signed. Positive adds units, negative removes them. Zero is a no-op. */
  delta: number;
  reason: StockReason;
  /**
   * The row that caused this. Null means "no idempotency key" — allowed only
   * for corrections, where repeating the same count IS legitimate.
   */
  sourceId?: string | null;
  note?: string | null;
};

/**
 * Append one movement.
 *
 * ⚠️ A DUPLICATE IS SUCCESS, NOT FAILURE. When the index rejects a repeat
 * (Postgres 23505), the movement it represents is already recorded, so the
 * caller's intent is satisfied. Surfacing that as an error would make an
 * ordinary double-click look broken — and worse, would make the caller's own
 * operation (shipping the order) look like it failed when it did not.
 */
export async function appendMovement(
  supabase: SupabaseClient,
  userId: string | null,
  input: MovementInput
): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  const delta = Math.round(input.delta);
  // `check (delta <> 0)` would reject this, and a zero movement means nothing
  // happened — which is a normal outcome (an order line whose product was
  // deleted), not something to report.
  if (delta === 0) return { ok: true, duplicate: false };

  // ⚠️ THE SEQUENCE IS DERIVED FROM THE APPLY/REVERSE BALANCE.
  //
  // A source's movements alternate: apply, reverse, apply, … The rule below is
  // "what number would the movement that put us in this state have had?" — so
  // a REPEAT recomputes an existing (sign, seq) key and the index rejects it,
  // while a genuine re-application computes a fresh one.
  //
  // Three simpler designs were tried and each let a real double-write through.
  // They are recorded so they are not rediscovered as improvements:
  //
  //   1. Plain row count. After `[-3]`, a repeat counts 1 prior row → seq=1,
  //      a different key from the original's seq=0. Deducts TWICE.
  //   2. Net sign ("is the net already negative?"). Fixes double-ship but not
  //      double-UN-ship: a reversal returns the net to zero, so a second
  //      reversal looks fresh and restores twice.
  //   3. Same-direction count. A repeat counts ITSELF forward, so it lands on
  //      a new key too. Deducts twice again.
  //
  // The read-then-write is deliberately not a transaction: two racing calls
  // compute the same seq and the index rejects the loser, which is the same
  // outcome a transaction would produce. The database is the arbiter, not this
  // arithmetic — which is the entire point of having the constraint.
  let applySeq = 0;
  if (input.sourceId) {
    const { data: prior, error: readError } = await supabase
      .from("product_stock_movements")
      .select("delta")
      .eq("reason", input.reason)
      .eq("source_id", input.sourceId)
      .eq("product_id", input.productId);

    if (readError) return { ok: false, error: readError.message };

    const rows = (prior ?? []) as { delta: number | string }[];

    // ⚠️ "APPLY" IS THE SOURCE'S OWN FIRST DIRECTION, not "negative".
    // A print run APPLIES by adding units and reverses by removing them; an
    // order does the exact opposite. Hard-coding negative-as-apply silently
    // rejected every first print run, because that positive movement was
    // read as a reversal with nothing to reverse.
    const applyDelta = rows.length === 0 ? delta : Number(rows[0].delta);
    const isApplying = Math.sign(delta) === Math.sign(applyDelta);

    const applied = rows.filter(
      (r) => Math.sign(Number(r.delta)) === Math.sign(applyDelta)
    ).length;
    const reversed = rows.length - applied;

    applySeq = isApplying
      ? // In balance → a genuine (re-)application. Otherwise a repeat, which
        // reuses the outstanding application's number so the index rejects it.
        applied === reversed
        ? applied
        : applied - 1
      : // A reversal is legal when exactly one application is outstanding.
        applied === reversed + 1
        ? reversed
        : reversed - 1;

    // ⚠️ Only reachable when a reversal arrives with nothing to reverse — the
    // UI cannot produce it (leaving `shipped` requires having entered it), but
    // a negative would violate `check (apply_seq >= 0)` and surface as a
    // confusing constraint error instead of the no-op it actually is.
    if (applySeq < 0) return { ok: true, duplicate: true };
  }

  const { error } = await supabase.from("product_stock_movements").insert({
    product_id: input.productId,
    delta,
    reason: input.reason,
    source_id: input.sourceId ?? null,
    apply_seq: applySeq,
    note: input.note?.trim().slice(0, 200) || null,
    created_by: userId,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: true, duplicate: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, duplicate: false };
}

/** Sum a set of movement rows as they arrive from PostgREST. */
export function sumDelta(rows: { delta: number | string }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.delta), 0);
}
