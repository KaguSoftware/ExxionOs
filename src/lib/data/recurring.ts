import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { rowsOrThrow } from "@/lib/data/query";
import type { Cadence, RecurringItem } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Materialise the transactions that recurring templates owe.
 *
 * Runs on page load rather than on a cron: with two users and a handful of
 * templates, a cron is a second system to operate, monitor and debug, and it
 * fails silently when it stops. A page load is a heartbeat that is impossible
 * to forget.
 *
 * ⚠️ THREE PROPERTIES, ALL LOAD-BEARING:
 *
 * 1. **Idempotent.** Guarded by the unique index
 *    `transactions (recurring_id, occurred_on) where recurring_id is not null`
 *    (migration 0003). Two tabs, a double-click, or both people opening the app
 *    at the same moment CANNOT produce duplicate rent — the database refuses it
 *    (23505), which we swallow. Proven against prod. Never rely on this
 *    function's own checks for that; a race would beat them.
 * 2. **Catches up.** If nobody opened the app for three months, three rows
 *    appear, each dated to the month it belongs to — not three rows dated
 *    today, which would misreport every historical chart.
 * 3. **Never generates the future.** Nothing past today: a projected expense
 *    sitting in the ledger as if it happened is a lie about your balance.
 */
export async function materialiseRecurring(
  supabase: SupabaseClient
): Promise<number> {
  const today = todayInIstanbul();

  const items = await rowsOrThrow<RecurringItem>(
    "recurring.active",
    supabase
      .from("recurring_items")
      .select("*")
      .eq("active", true)
      .lte("starts_on", today)
  );

  if (items.length === 0) return 0;

  const pending: {
    occurred_on: string;
    direction: string;
    amount_minor: number;
    description: string;
    category_id: string | null;
    recurring_id: string;
  }[] = [];

  for (const item of items) {
    // Resume from the last generated date, else from the start. This is only
    // an optimisation — correctness comes from the unique index.
    const from = item.last_generated_on ?? previousDay(item.starts_on);
    const until = item.ends_on && item.ends_on < today ? item.ends_on : today;

    for (const date of dueDates(item, from, until)) {
      pending.push({
        occurred_on: date,
        direction: item.direction,
        amount_minor: item.amount_minor,
        description: item.label,
        category_id: item.category_id,
        recurring_id: item.id,
      });
    }
  }

  if (pending.length === 0) return 0;

  // One trip for every template's backlog, not one per row.
  const { error } = await supabase.from("transactions").insert(pending);

  // 23505 = unique violation: another tab won the race and already inserted
  // these. That is the guarantee working, not a failure — the rows exist,
  // which is all we wanted.
  if (error && error.code !== "23505") {
    throw new Error(`recurring.insert: ${error.code} ${error.message}`);
  }

  // Advance the bookmark so the next load doesn't rescan the backlog.
  await Promise.all(
    items.map((item) =>
      supabase
        .from("recurring_items")
        .update({ last_generated_on: today })
        .eq("id", item.id)
    )
  );

  return error ? 0 : pending.length;
}

/**
 * Every date this template owes in (from, until].
 * `from` is exclusive so a bookmark isn't re-generated.
 */
function dueDates(item: RecurringItem, from: string, until: string): string[] {
  const out: string[] = [];
  const step = MONTHS_PER_CADENCE[item.cadence];

  // Walk from the template's start so the anchor month is always right — a
  // quarterly item starting in February is due Feb/May/Aug/Nov, not
  // Jan/Apr/Jul/Oct.
  const [startY, startM] = item.starts_on.split("-").map(Number);
  const [untilY, untilM] = until.split("-").map(Number);

  const totalMonths = (untilY - startY) * 12 + (untilM - startM);
  // A tiny bound so a corrupt row can't spin: ~40 years of monthly.
  const maxSteps = Math.min(Math.floor(totalMonths / step), 500);

  for (let i = 0; i <= maxSteps; i++) {
    const monthIndex = startM - 1 + i * step;
    const year = startY + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const date = clampToMonth(year, month, item.day_of_month);

    if (date <= from) continue;
    if (date > until) break;
    if (date < item.starts_on) continue;
    if (item.ends_on && date > item.ends_on) break;

    out.push(date);
  }

  return out;
}

const MONTHS_PER_CADENCE: Record<Cadence, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * `day_of_month` clamped into a real date.
 *
 * ⚠️ A template set to the 31st must still bill in February — on the 28th (or
 * 29th). Skipping the month, or rolling into March, would both be wrong: rent
 * is owed once a month regardless of how many days the month happens to have.
 */
function clampToMonth(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${`${month}`.padStart(2, "0")}-${`${safeDay}`.padStart(2, "0")}`;
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
