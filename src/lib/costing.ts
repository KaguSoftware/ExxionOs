import type { Material, Product } from "@/lib/types";

/**
 * Product unit cost.
 *
 * ⚠️ COMPUTED AT READ TIME, NEVER STORED. A stored cost goes stale the moment a
 * filament price changes, and you end up with a table of numbers that are
 * quietly wrong — the worst kind, because they still look like answers.
 * Recomputing is free (it's two multiplications) and always right: re-pricing
 * one material re-costs every product that uses it.
 *
 * Everything is integer kuruş, like the rest of the app (see lib/money.ts).
 */

export type CostBreakdown = {
  materialMinor: number;
  machineMinor: number;
  totalMinor: number;
};

/**
 * Returns `null` when the inputs aren't there.
 *
 * ⚠️ NULL, NOT ZERO. An unknown cost must read as "unknown" — rendering ₺0,00
 * for a product nobody has costed yet claims it is FREE, which is a different
 * and much more damaging statement than "we don't know".
 */
export function productCost(
  product: Pick<Product, "grams" | "print_hours" | "material_id">,
  materials: Material[],
  machineHourRateMinor: number
): CostBreakdown | null {
  const material = product.material_id
    ? (materials.find((m) => m.id === product.material_id) ?? null)
    : null;

  const grams = numeric(product.grams);
  const hours = numeric(product.print_hours);

  // Material cost needs BOTH a material and a weight; machine cost needs hours.
  // A product with neither has no computable cost at all.
  const hasMaterial = material != null && grams != null;
  const hasMachine = hours != null;
  if (!hasMaterial && !hasMachine) return null;

  // Rounded per TERM, not once at the end, so each component is itself an exact
  // number of kuruş and the two always sum to the displayed total.
  const materialMinor = hasMaterial
    ? Math.round((grams / 1000) * material.cost_per_kg_minor)
    : 0;
  const machineMinor = hasMachine ? Math.round(hours * machineHourRateMinor) : 0;

  return {
    materialMinor,
    machineMinor,
    totalMinor: materialMinor + machineMinor,
  };
}

/**
 * Margin = price − cost, in kuruş. `null` unless BOTH are known — a margin
 * computed against an unknown cost would just be the price wearing a different
 * label.
 */
export function productMargin(
  product: Pick<Product, "price_minor">,
  cost: CostBreakdown | null
): number | null {
  if (cost == null || product.price_minor == null) return null;
  return product.price_minor - cost.totalMinor;
}

/**
 * Postgres `numeric` arrives over PostgREST as a STRING, not a number — it is
 * arbitrary-precision and would lose exactness as a JS float. Parse it here,
 * once, rather than letting `"12.5" * 2` silently succeed elsewhere.
 */
function numeric(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
