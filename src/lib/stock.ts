import type { ProductStockMovement, StockReason } from "@/lib/types";

/**
 * Finished-unit stock, derived from the ledger.
 *
 * ⚠️ ON-HAND IS ALWAYS `sum(delta)`, NEVER A STORED COLUMN — the same rule
 * `lib/costing.ts` applies to cost, for the same reason. A cached count is
 * wrong the moment anything behind it changes, and nothing tells you it went
 * wrong. Summing is free (it's one pass) and cannot drift.
 *
 * The ledger also answers WHY stock is what it is — "printed 10, sold 7, gave
 * away 1" — which a counter fundamentally cannot.
 */

/** Units on hand for one product. */
export function onHand(movements: ProductStockMovement[]): number {
  return movements.reduce((sum, m) => sum + m.delta, 0);
}

/** Units on hand for every product that has ever moved, keyed by product id. */
export function onHandByProduct(
  movements: ProductStockMovement[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of movements) {
    totals.set(m.product_id, (totals.get(m.product_id) ?? 0) + m.delta);
  }
  return totals;
}

/**
 * Where the current count came from, for the "why" line under a stock figure.
 *
 * ⚠️ `made` counts only what was ADDED by printing, and `sold`/`given` are
 * reported as positive magnitudes even though their deltas are negative —
 * "sold 7" reads better than "sold −7". Reversals (un-shipping) net against
 * their own bucket, so an order shipped and then dragged back contributes
 * zero here rather than inflating both sides.
 */
export function stockBreakdown(movements: ProductStockMovement[]): {
  made: number;
  sold: number;
  given: number;
  corrected: number;
} {
  const net = (reason: StockReason) =>
    movements.filter((m) => m.reason === reason).reduce((s, m) => s + m.delta, 0);

  return {
    made: net("print_run"),
    sold: -net("order"),
    given: -net("sample"),
    corrected: net("correction"),
  };
}

/**
 * The threshold for "you're about to run out".
 *
 * Deliberately a constant, not a per-product setting: with two people and a
 * few dozen designs, a configurable reorder point is a field nobody would ever
 * fill in, and an unfilled field would silence the warning entirely.
 */
export const LOW_STOCK_AT = 2;

/** True when a product is at or below the low-stock line but not yet out. */
export function isLow(units: number): boolean {
  return units > 0 && units <= LOW_STOCK_AT;
}
