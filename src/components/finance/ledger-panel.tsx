"use client";

import { Download } from "lucide-react";
import { useMemo } from "react";

import { CategoryChart, InOutChart, NetChart } from "@/components/finance/charts";
import { FinanceFilterBar } from "@/components/finance/filter-bar";
import { StatRow } from "@/components/finance/stat-row";
import { TransactionList } from "@/components/finance/transaction-list";
import { Button } from "@/components/ui/button";
import { downloadCsv, transactionsToCsv } from "@/lib/finance-export";
import { categoryBreakdown, monthlySeries, totals } from "@/lib/finance-series";
import { useI18n } from "@/lib/i18n/client";
import type { Category, Transaction } from "@/lib/types";
import { useFinanceFilters } from "@/lib/use-finance-filters";

export function LedgerPanel({
  transactions,
  categories,
  today,
}: {
  transactions: Transaction[];
  categories: Category[];
  today: string;
}) {
  const { t } = useI18n();

  const defaults = useMemo(
    () => ({ from: `${shiftMonths(today.slice(0, 7), -11)}-01`, to: today }),
    [today]
  );

  const { filters, patch, reset, dirty } = useFinanceFilters(defaults);

  /**
   * ⚠️ FILTERING IS ENTIRELY CLIENT-SIDE. The page already holds every row in
   * the window, so refining a filter costs ZERO round-trips — it's a useMemo
   * over an array already in memory. Re-querying the server per keystroke is
   * the thing this design exists to avoid.
   */
  const visible = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return transactions.filter((row) => {
      if (row.occurred_on < filters.from || row.occurred_on > filters.to) return false;
      if (filters.direction && row.direction !== filters.direction) return false;
      if (
        filters.categories.length > 0 &&
        !filters.categories.includes(row.category_id ?? "")
      )
        return false;
      if (needle && !row.description.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, filters]);

  // The stat row is always THIS MONTH, deliberately independent of the
  // filters: it answers "how are we doing right now", and a figure that
  // changed as you refined a search would answer nothing.
  const monthTotals = useMemo(() => {
    const month = today.slice(0, 7);
    return totals(transactions.filter((r) => r.occurred_on.slice(0, 7) === month));
  }, [transactions, today]);

  const series = useMemo(
    () => monthlySeries(transactions, today.slice(0, 7), 12),
    [transactions, today]
  );

  // The breakdown DOES follow the filters — it answers "where did the money
  // go in what I'm looking at".
  const breakdown = useMemo(
    () => categoryBreakdown(visible, categories, t("finance.other")),
    [visible, categories, t]
  );

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.archived_at),
    [categories]
  );

  return (
    <div className="flex flex-col gap-4">
      <StatRow totals={monthTotals} />

      <div className="grid gap-4 lg:grid-cols-2">
        <InOutChart data={series} />
        <CategoryChart data={breakdown} />
      </div>

      <NetChart data={series} />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <FinanceFilterBar
            filters={filters}
            patch={patch}
            reset={reset}
            dirty={dirty}
            categories={activeCategories}
          />
          <Button
            size="sm"
            onClick={() => downloadCsv(transactionsToCsv(visible, categories))}
            icon={<Download aria-hidden className="size-3.5" />}
            disabled={visible.length === 0}
          >
            {t("finance.exportCsv")}
          </Button>
        </div>

        <TransactionList
          rows={visible}
          categories={categories}
          emptyIsFiltered={transactions.length > 0}
        />
      </div>
    </div>
  );
}

function shiftMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = m - 1 + delta;
  const year = y + Math.floor(index / 12);
  const monthNum = ((index % 12) + 12) % 12;
  return `${year}-${`${monthNum + 1}`.padStart(2, "0")}`;
}
