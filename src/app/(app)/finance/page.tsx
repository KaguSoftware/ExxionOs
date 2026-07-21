import { after } from "next/server";
import { Suspense } from "react";

import { FinancePanels } from "@/components/finance/panels";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { materialiseRecurring } from "@/lib/data/recurring";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Category, RecurringItem, Transaction } from "@/lib/types";
import { addDays, todayInIstanbul } from "@/lib/utils";

/**
 * Finance — ONE page, three tabs, switched in pure client state.
 *
 * ⚠️ ONE WAVE. Every query below sits in a SINGLE `Promise.all`, INCLUDING the
 * data for tabs that aren't visible yet. A round-trip costs ~305ms; a query
 * added to an existing wave costs ~3ms — so fetching all three tabs up front is
 * nearly free, and switching between them then costs NOTHING. Making Categories
 * or Recurring their own route would trade 3ms for 305ms on every switch.
 *
 * When a later phase needs another figure here, it goes INSIDE this array —
 * never in an `await` above it. Count waves, not queries.
 */
export default async function FinancePage() {
  await getSessionContext();
  const supabase = await createClient();

  const today = todayInIstanbul();
  // ~13 months back, so a 12-month chart has a complete first bucket.
  const windowStart = `${addDays(today, -400).slice(0, 7)}-01`;

  const [transactions, categories, recurring] = await Promise.all([
    rowsOrThrow<Transaction>(
      "finance.transactions",
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", windowStart)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000)
    ),
    rowsOrThrow<Category>(
      "finance.categories",
      supabase.from("categories").select("*").order("sort_order")
    ),
    rowsOrThrow<RecurringItem>(
      "finance.recurring",
      supabase.from("recurring_items").select("*").order("label")
    ),
  ]);

  /**
   * Materialise any due recurring transactions AFTER the response ships. The
   * user should never wait on bookkeeping, and the realtime subscription below
   * pulls the new rows in as soon as they land. Safe to run on every load:
   * idempotency is guaranteed by a unique index, not by this call site.
   */
  if (recurring.some((item) => item.active)) {
    after(async () => {
      try {
        await materialiseRecurring(supabase);
      } catch (error) {
        // Must never take the page down: the ledger is still correct, just
        // missing rows the next load will add.
        console.error("recurring materialisation failed", error);
      }
    });
  }

  return (
    <>
      <LiveRefresh tables={["transactions", "recurring_items", "categories"]} />
      {/* useSearchParams (in the tab shell and the filter hook) requires a
          Suspense boundary or the build fails. */}
      <Suspense>
        <FinancePanels
          transactions={transactions}
          categories={categories}
          recurring={recurring}
          today={today}
        />
      </Suspense>
    </>
  );
}
