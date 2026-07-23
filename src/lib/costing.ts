import type { Product, Supply } from "@/lib/types";

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

/**
 * The two costing rates that live on app_settings (id=1). Bundled so a page
 * fetches them once and passes one prop down instead of two loose scalars, and
 * so a new rate (were one ever added) is threaded in exactly one place.
 */
export type CostingRates = {
  machineHourRateMinor: number;
  laborHourRateMinor: number;
};

/** Read both rates off a partial app_settings row, defaulting missing to 0. */
export function costingRates(
  settings:
    | { machine_hour_rate_minor?: number | null; labor_hour_rate_minor?: number | null }
    | null
    | undefined
): CostingRates {
  return {
    machineHourRateMinor: settings?.machine_hour_rate_minor ?? 0,
    laborHourRateMinor: settings?.labor_hour_rate_minor ?? 0,
  };
}

export type CostBreakdown = {
  materialMinor: number;
  machineMinor: number;
  /** Human time on the piece (post-processing, painting) — see 0024. */
  laborMinor: number;
  totalMinor: number;
};

/**
 * Returns `null` when the inputs aren't there.
 *
 * ⚠️ NULL, NOT ZERO. An unknown cost must read as "unknown" — rendering ₺0,00
 * for a product nobody has costed yet claims it is FREE, which is a different
 * and much more damaging statement than "we don't know".
 */
/**
 * The filament weight to cost/deduct AGAINST: the measured weight (supports
 * included) if this product has been weighed, else the estimate. One place
 * decides, so costing, the print-run deduction and any UI preview all agree —
 * "measured overrides estimate" lives here and nowhere else. See 0021.
 */
export function effectiveGrams(
  product: Pick<Product, "grams" | "measured_grams">
): number | null {
  return numeric(product.measured_grams) ?? numeric(product.grams);
}

export function productCost(
  product: Pick<
    Product,
    "grams" | "measured_grams" | "print_hours" | "labor_hours" | "supply_id"
  >,
  supplies: Pick<Supply, "id" | "cost_per_kg_minor">[],
  machineHourRateMinor: number,
  laborHourRateMinor: number
): CostBreakdown | null {
  const supply = product.supply_id
    ? (supplies.find((s) => s.id === product.supply_id) ?? null)
    : null;

  const grams = effectiveGrams(product);
  const hours = numeric(product.print_hours);
  const laborHours = numeric(product.labor_hours);

  // Material cost needs a supply WITH a per-kg price and a weight; machine cost
  // needs hours; labour cost needs labour hours AND a rate. A product with none
  // of them has no computable cost at all. A supply whose cost_per_kg_minor is
  // null (a box, tape) contributes no material cost.
  const hasMaterial =
    supply != null && supply.cost_per_kg_minor != null && grams != null;
  const hasMachine = hours != null;
  const hasLabor = laborHours != null && laborHourRateMinor > 0;
  if (!hasMaterial && !hasMachine && !hasLabor) return null;

  // Rounded per TERM, not once at the end, so each component is itself an exact
  // number of kuruş and the three always sum to the displayed total.
  const materialMinor = hasMaterial
    ? Math.round((grams / 1000) * supply.cost_per_kg_minor!)
    : 0;
  const machineMinor = hasMachine ? Math.round(hours * machineHourRateMinor) : 0;
  const laborMinor = hasLabor ? Math.round(laborHours * laborHourRateMinor) : 0;

  return {
    materialMinor,
    machineMinor,
    laborMinor,
    totalMinor: materialMinor + machineMinor + laborMinor,
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
 * Margin as a percentage OF THE PRICE (gross margin), rounded to a whole
 * percent. `null` when margin is unknown or the price is 0 — a percentage of
 * zero is undefined, not 0%. Lets a ₺50 margin on a ₺100 item read differently
 * from the same ₺50 on a ₺500 one, which the absolute figure alone hides.
 */
export function productMarginPct(
  product: Pick<Product, "price_minor">,
  cost: CostBreakdown | null
): number | null {
  const margin = productMargin(product, cost);
  if (margin == null || !product.price_minor) return null;
  return Math.round((margin / product.price_minor) * 100);
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
