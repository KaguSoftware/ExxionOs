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
