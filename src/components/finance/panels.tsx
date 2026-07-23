"use client";

import { FileBarChart, Plus } from "lucide-react";
import Link from "next/link";

import { CategoriesPanel } from "@/components/finance/categories-panel";
import { LedgerPanel } from "@/components/finance/ledger-panel";
import { RecurringPanel } from "@/components/finance/recurring-panel";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { Category, RecurringItem, Transaction } from "@/lib/types";

/**
 * Finance's three tabs. Every panel's data arrived in the page's single wave,
 * so switching tabs is pure client state — no navigation, no refetch.
 */
export function FinancePanels({
  transactions,
  categories,
  recurring,
  today,
}: {
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringItem[];
  today: string;
}) {
  const { t } = useI18n();

  return (
    <TabbedPanels
      title={t("finance.title")}
      description={t("finance.subtitle")}
      tabs={[
        {
          id: "ledger",
          label: t("finance.transactions"),
          action: (
            <div className="flex items-center gap-2">
              <a href="/finance/report" target="_blank" rel="noopener">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<FileBarChart aria-hidden className="size-3.5" />}
                >
                  {t("report.open")}
                </Button>
              </a>
              <Link href="/finance/new">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus aria-hidden className="size-3.5" />}
                >
                  {t("finance.newTransaction")}
                </Button>
              </Link>
            </div>
          ),
          content: (
            <LedgerPanel
              transactions={transactions}
              categories={categories}
              today={today}
            />
          ),
        },
        {
          id: "recurring",
          label: t("finance.recurring"),
          count: recurring.filter((r) => r.active).length,
          content: <RecurringPanel items={recurring} categories={categories} />,
        },
        {
          id: "categories",
          label: t("finance.categories"),
          content: <CategoriesPanel categories={categories} />,
        },
      ]}
    />
  );
}
