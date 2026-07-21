"use client";

import { Paperclip, Receipt, Repeat } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/client";
import type { Category, Transaction } from "@/lib/types";
import { cn, formatDate, formatMinor } from "@/lib/utils";

export function TransactionList({
  rows,
  categories,
  emptyIsFiltered,
}: {
  rows: Transaction[];
  categories: Category[];
  /** True when rows exist but the filters hide them — a different message. */
  emptyIsFiltered: boolean;
}) {
  const { t, locale } = useI18n();

  if (rows.length === 0) {
    return (
      <Panel title={t("finance.transactions")}>
        <EmptyState
          icon={<Receipt aria-hidden className="size-4" />}
          title={
            emptyIsFiltered ? t("finance.noMatches") : t("finance.noTransactions")
          }
          description={
            emptyIsFiltered
              ? t("finance.noMatchesHint")
              : t("finance.noTransactionsHint")
          }
        />
      </Panel>
    );
  }

  // Group by day so a long ledger reads as days rather than an undifferentiated
  // wall of rows.
  const groups: { date: string; rows: Transaction[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.occurred_on) last.rows.push(row);
    else groups.push({ date: row.occurred_on, rows: [row] });
  }

  return (
    <Panel
      title={t("finance.transactions")}
      description={`${rows.length}`}
      bodyClassName="p-0"
    >
      <ul>
        {groups.map((group) => (
          <Fragment key={group.date}>
            <li className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-2xs font-medium tracking-wide text-faint uppercase">
                {formatDate(group.date, locale)}
              </span>
            </li>
            {group.rows.map((row) => (
              <li key={row.id} className="border-b border-line last:border-0">
                <Link
                  href={`/finance/${row.id}`}
                  className="row-comfortable flex items-center gap-3 transition-colors hover:bg-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {row.description || "—"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {row.category_id && (
                        <span className="text-xs text-muted">
                          {categories.find((c) => c.id === row.category_id)?.name}
                        </span>
                      )}
                      {row.recurring_id && (
                        <Badge icon={<Repeat aria-hidden className="size-2.5" />}>
                          {t("finance.generated")}
                        </Badge>
                      )}
                      {/* The cross-section back-link made visible: this row
                          came from Equipment/Shipping/etc, and deleting it
                          here would not delete its cause. */}
                      {row.source_type && (
                        <Badge tone="accent">
                          {t("finance.fromSection", {
                            section: sectionLabel(row.source_type, t),
                          })}
                        </Badge>
                      )}
                      {row.receipt_path && (
                        <Paperclip aria-hidden className="size-3 text-faint" />
                      )}
                    </div>
                  </div>

                  {/* ⚠️ The +/− sign is REQUIRED secondary encoding for the
                      floor-band green/red pair — never colour alone. */}
                  <span
                    className={cn(
                      "tnum shrink-0 text-sm font-medium",
                      row.direction === "in" ? "text-success" : "text-danger"
                    )}
                  >
                    {row.direction === "in" ? "+" : "−"}
                    {formatMinor(row.amount_minor)}
                  </span>
                </Link>
              </li>
            ))}
          </Fragment>
        ))}
      </ul>
    </Panel>
  );
}

function sectionLabel(
  source: string,
  t: (key: never, vars?: Record<string, string | number>) => string
): string {
  const map: Record<string, string> = {
    equipment: "finance.fromEquipment",
    shipping: "finance.fromShipping",
    marketing: "finance.fromMarketing",
    client: "finance.fromClient",
  };
  const key = map[source];
  return key ? t(key as never) : source;
}
