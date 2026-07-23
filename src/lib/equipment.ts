import type { MachineStatus, Supply } from "@/lib/types";

/**
 * Is this supply at or below its warning level?
 *
 * ⚠️ A null threshold means "never warn" — correct for something you buy on
 * demand rather than keep stocked. Treating null as 0 would either warn about
 * everything or nothing, and both are noise.
 *
 * Postgres `numeric` arrives over PostgREST as a STRING, so both values are
 * coerced here rather than compared as text — `"9" > "10"` is true for strings.
 */
export function isLowStock(supply: Pick<Supply, "quantity" | "low_threshold">) {
  if (supply.low_threshold == null || supply.low_threshold === "") return false;
  const quantity = Number(supply.quantity);
  const threshold = Number(supply.low_threshold);
  if (!Number.isFinite(quantity) || !Number.isFinite(threshold)) return false;
  return quantity <= threshold;
}

/**
 * A suggested reorder quantity for a low supply: enough to reach TWICE the
 * threshold, so a restock clears the warning with headroom rather than landing
 * exactly on the line and re-tripping next week.
 *
 * ⚠️ Returns null when there's no threshold to aim at (nothing to suggest) or
 * the numbers don't parse — the caller shows a blank, never a fabricated 0.
 * `numeric`-as-string is coerced, same as `isLowStock`.
 */
export function suggestedReorder(
  supply: Pick<Supply, "quantity" | "low_threshold">
): number | null {
  if (supply.low_threshold == null || supply.low_threshold === "") return null;
  const quantity = Number(supply.quantity);
  const threshold = Number(supply.low_threshold);
  if (!Number.isFinite(quantity) || !Number.isFinite(threshold)) return null;
  const target = threshold * 2;
  return Math.max(0, Math.ceil(target - quantity));
}

export type InventoryValue = {
  /** Kuruş of stock we can actually price. */
  valuedMinor: number;
  /** Supplies in stock we CAN'T price (no per-kg price) — reported, not faked. */
  uncostedCount: number;
};

/**
 * The value of stock on hand.
 *
 * ⚠️ HONEST, not complete. A printing material (kg, with a `cost_per_kg_minor`)
 * is valued at `quantity_kg × cost_per_kg` — sound. Anything else has no
 * reliable per-unit price: `last_price_minor` is the BATCH total of the last
 * restock, not a unit price, so multiplying it by current stock would invent a
 * number. Those supplies are counted in `uncostedCount` rather than valued at
 * ₺0 — the same null-not-zero honesty as `productCost`/`givenAwayMinor`. Only
 * supplies actually in stock (quantity > 0) count toward the uncosted tally.
 */
export function inventoryValue(
  supplies: Pick<Supply, "quantity" | "cost_per_kg_minor">[]
): InventoryValue {
  let valuedMinor = 0;
  let uncostedCount = 0;

  for (const supply of supplies) {
    const quantity = Number(supply.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    if (supply.cost_per_kg_minor != null) {
      // Printing material: quantity is in kg (the unit is locked to kg for
      // these), so quantity × per-kg price is the value directly.
      valuedMinor += Math.round(quantity * supply.cost_per_kg_minor);
    } else {
      uncostedCount++;
    }
  }

  return { valuedMinor, uncostedCount };
}

/**
 * The Finance categories whose supplies are PRINTING MATERIALS — weighed in
 * grams and costed per kg, deducted per print run.
 *
 * ⚠️ Matched by NAME against the seeded Finance categories. If you rename
 * "Filament"/"Resin" in Finance, a supply in that renamed category stops being
 * treated as filament (its cost stops feeding print costing). Documented in
 * migration 0016; a rename-proof flag would need a column on categories.
 */
export const PRINTING_CATEGORIES = ["Filament", "Resin"] as const;

export function isPrintingCategory(category: string | null | undefined): boolean {
  return category != null && (PRINTING_CATEGORIES as readonly string[]).includes(category);
}

/** Machines that want a human: broken first, then needs-attention. */
export function needsAttention(status: MachineStatus) {
  return status === "broken" || status === "needs_attention";
}

/**
 * Sort order for the machine list: the ones that need you, first.
 * Retired sinks to the bottom — it is history, not work.
 */
export const STATUS_RANK: Record<MachineStatus, number> = {
  broken: 0,
  needs_attention: 1,
  operational: 2,
  retired: 3,
};

export const STATUS_KEY: Record<MachineStatus, string> = {
  operational: "equipment.operational",
  needs_attention: "equipment.needs_attention",
  broken: "equipment.broken",
  retired: "equipment.retired",
};

/**
 * Tone for a machine status.
 *
 * ⚠️ Colour marks STATE here, which is legitimate — but it never carries the
 * meaning alone: every status also renders its word. See badge.tsx.
 */
export const STATUS_TONE: Record<
  MachineStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  operational: "success",
  needs_attention: "warning",
  broken: "danger",
  retired: "neutral",
};
