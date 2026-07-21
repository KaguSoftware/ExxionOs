import { MAX_CATEGORY_SLOTS } from "@/lib/chart-palette";
import type { Category, Transaction } from "@/lib/types";

/**
 * Pure aggregation for the Finance charts. No React, no Supabase — so the
 * arithmetic can be tested directly, which for money it must be.
 *
 * Everything here stays in integer KURUŞ. Division happens only at render.
 */

export type MonthPoint = {
  /** YYYY-MM */
  month: string;
  inMinor: number;
  outMinor: number;
  netMinor: number;
};

/**
 * The last `count` months ending at `endMonth`, INCLUDING months with no
 * transactions.
 *
 * ⚠️ The zero-filling is the point. Skipping empty months would compress the
 * x-axis and draw a line between March and July as if they were adjacent —
 * which misrepresents a quiet period as continuous activity.
 */
export function monthlySeries(
  rows: Transaction[],
  endMonth: string,
  count = 12
): MonthPoint[] {
  const buckets = new Map<string, MonthPoint>();

  for (const month of lastMonths(endMonth, count)) {
    buckets.set(month, { month, inMinor: 0, outMinor: 0, netMinor: 0 });
  }

  for (const row of rows) {
    const month = row.occurred_on.slice(0, 7);
    const bucket = buckets.get(month);
    if (!bucket) continue; // outside the window
    if (row.direction === "in") bucket.inMinor += row.amount_minor;
    else bucket.outMinor += row.amount_minor;
    bucket.netMinor = bucket.inMinor - bucket.outMinor;
  }

  return [...buckets.values()];
}

/** `count` YYYY-MM strings ending at (and including) `endMonth`, ascending. */
export function lastMonths(endMonth: string, count: number): string[] {
  const [year, month] = endMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const index = month - 1 - i;
    const y = year + Math.floor(index / 12);
    const m = ((index % 12) + 12) % 12;
    out.push(`${y}-${`${m + 1}`.padStart(2, "0")}`);
  }
  return out;
}

export type CategorySlice = {
  id: string;
  name: string;
  totalMinor: number;
  /** Fixed palette slot, or -1 for the folded "Other" row. */
  slot: number;
};

/**
 * Expense totals per category, largest first.
 *
 * ⚠️ Past `MAX_CATEGORY_SLOTS` everything folds into ONE "Other" row rather
 * than cycling the palette. A repeated hue would claim two unrelated categories
 * are the same thing.
 */
export function categoryBreakdown(
  rows: Transaction[],
  categories: Category[],
  otherLabel: string
): CategorySlice[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.direction !== "out") continue;
    const key = row.category_id ?? "__none";
    totals.set(key, (totals.get(key) ?? 0) + row.amount_minor);
  }

  const named = [...totals.entries()]
    .map(([id, totalMinor]) => ({
      id,
      name: categories.find((c) => c.id === id)?.name ?? otherLabel,
      totalMinor,
      slot: 0,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);

  const head = named.slice(0, MAX_CATEGORY_SLOTS).map((slice, index) => ({
    ...slice,
    slot: index,
  }));
  const tail = named.slice(MAX_CATEGORY_SLOTS);

  if (tail.length > 0) {
    head.push({
      id: "__other",
      name: otherLabel,
      totalMinor: tail.reduce((sum, s) => sum + s.totalMinor, 0),
      slot: -1,
    });
  }

  return head;
}

/** Totals for the stat row, over whatever set is passed in. */
export function totals(rows: Transaction[]) {
  let inMinor = 0;
  let outMinor = 0;
  for (const row of rows) {
    if (row.direction === "in") inMinor += row.amount_minor;
    else outMinor += row.amount_minor;
  }
  return { inMinor, outMinor, netMinor: inMinor - outMinor };
}
