import type { PrintRun, Product, Supply } from "@/lib/types";

/**
 * Scrap / failure analytics over `print_runs`. Pure — no React, no Supabase.
 *
 * ⚠️ THE SEMANTICS, stated once:
 * - `failed` runs are WASTE: the filament burned and produced nothing sellable.
 *   This is what "scrap" counts.
 * - `test` runs are DELIBERATE (a calibration cube, a fit check). Their grams
 *   are reported SEPARATELY as "test prints", never folded into scrap — calling
 *   an intentional test a failure would inflate the waste figure and punish
 *   good practice.
 * - `good` runs are the baseline the rate is measured against.
 *
 * Wasted MONEY needs a supply with a per-kg price. A failed run whose product
 * had no costed supply is counted in `uncostedRuns` rather than valued at ₺0 —
 * the same null-not-zero honesty as `productCost` and `givenAwayMinor`.
 */

export type ProductScrap = {
  productId: string | null;
  productName: string;
  totalUnits: number;
  failedUnits: number;
  /** failedUnits / totalUnits, or null when nothing has been printed. */
  scrapRate: number | null;
  wastedGrams: number;
  /** Cost of the wasted grams, in kuruş. */
  wastedMinor: number;
  /** Failed runs that couldn't be valued (no costed supply). */
  uncostedRuns: number;
};

export type ScrapStats = {
  totalUnits: number;
  failedUnits: number;
  scrapRate: number | null;
  testUnits: number;
  testGrams: number;
  wastedGrams: number;
  wastedMinor: number;
  uncostedRuns: number;
  /** Per-product breakdown, sorted by wasted money then wasted grams desc. */
  byProduct: ProductScrap[];
};

function grams(value: string | number | null): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function scrapStats(
  runs: PrintRun[],
  products: Pick<Product, "id" | "name">[],
  supplies: Pick<Supply, "id" | "cost_per_kg_minor">[]
): ScrapStats {
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const costPerKg = new Map(
    supplies.map((s) => [s.id, s.cost_per_kg_minor] as const)
  );

  const perProduct = new Map<string, ProductScrap>();
  const keyFor = (id: string | null) => id ?? "__deleted__";

  let totalUnits = 0;
  let failedUnits = 0;
  let testUnits = 0;
  let testGrams = 0;
  let wastedGrams = 0;
  let wastedMinor = 0;
  let uncostedRuns = 0;

  for (const run of runs) {
    const key = keyFor(run.product_id);
    let row = perProduct.get(key);
    if (!row) {
      row = {
        productId: run.product_id,
        productName: run.product_id
          ? (productName.get(run.product_id) ?? "—")
          : "—",
        totalUnits: 0,
        failedUnits: 0,
        scrapRate: null,
        wastedGrams: 0,
        wastedMinor: 0,
        uncostedRuns: 0,
      };
      perProduct.set(key, row);
    }

    // `test` runs are deliberate — kept out of the total the scrap rate is
    // measured over, and reported on their own.
    if (run.outcome === "test") {
      testUnits += run.units;
      testGrams += grams(run.grams_used);
      continue;
    }

    row.totalUnits += run.units;
    totalUnits += run.units;

    if (run.outcome === "failed") {
      row.failedUnits += run.units;
      failedUnits += run.units;

      const g = grams(run.grams_used);
      row.wastedGrams += g;
      wastedGrams += g;

      const perKg = run.supply_id ? costPerKg.get(run.supply_id) : null;
      if (perKg != null) {
        const minor = Math.round((g / 1000) * perKg);
        row.wastedMinor += minor;
        wastedMinor += minor;
      } else if (g > 0) {
        row.uncostedRuns++;
        uncostedRuns++;
      }
    }
  }

  const byProduct = [...perProduct.values()]
    .map((row) => ({
      ...row,
      scrapRate: row.totalUnits > 0 ? row.failedUnits / row.totalUnits : null,
    }))
    // Only products that actually wasted something are worth listing.
    .filter((row) => row.failedUnits > 0)
    .sort((a, b) => b.wastedMinor - a.wastedMinor || b.wastedGrams - a.wastedGrams);

  return {
    totalUnits,
    failedUnits,
    scrapRate: totalUnits > 0 ? failedUnits / totalUnits : null,
    testUnits,
    testGrams,
    wastedGrams,
    wastedMinor,
    uncostedRuns,
    byProduct,
  };
}
