"use client";

import { Paperclip, Receipt, Repeat } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { useI18n } from "@/lib/i18n/client";
import type { Category, Transaction } from "@/lib/types";
import { cn, formatDate, formatMinor } from "@/lib/utils";

/**
 * How many rows to render before "Show more". The whole ~13-month window is
 * already in memory (the page loads it in one wave so filtering stays instant),
 * so this is a pure RENDER cap — no round-trip — that keeps a long ledger from
 * painting thousands of DOM nodes at once. Filtering still runs over every row;
 * only the rendered slice is bounded.
 */
const PAGE_SIZE = 100;

export function TransactionList({
  rows,
  categories,
  emptyIsFiltered,
  onClearFilters,
}: {
  rows: Transaction[];
  categories: Category[];
  /** True when rows exist but the filters hide them — a different message. */
  emptyIsFiltered: boolean;
  /** Resets the parent's filters — the way OUT of a filtered-to-nothing state. */
  onClearFilters?: () => void;
}) {
  const { t, locale } = useI18n();

  const [limit, setLimit] = useState(PAGE_SIZE);

  // Reset the window to the top whenever the filtered set changes, so a new
  // filter doesn't land the reader deep in a previously-expanded list. Adopted
  // during render (never an effect) — the same pattern as the reminders panel.
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setLimit(PAGE_SIZE);
  }

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
          action={
            emptyIsFiltered && onClearFilters ? (
              <Button size="sm" onClick={onClearFilters}>
                {t("common.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      </Panel>
    );
  }

  // Only the first `limit` rows are rendered; "Show more" raises the cap.
  const visible = rows.slice(0, limit);
  const hasMore = rows.length > visible.length;

  // Group by day so a long ledger reads as days rather than an undifferentiated
  // wall of rows.
  const groups: { date: string; rows: Transaction[] }[] = [];
  for (const row of visible) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.occurred_on) last.rows.push(row);
    else groups.push({ date: row.occurred_on, rows: [row] });
  }

  return (
    // Rows are inset rounded pills (.row-hover with a little side padding) so a
    // hover floats inside the panel instead of a full-bleed bar. The day
    // headers stay full-width — a sticky header must cover the content scrolling
    // under it — but sit flush with overflow-hidden clipping their tint to the
    // rounded panel.
    <Panel
      title={t("finance.transactions")}
      description={
        hasMore ? `${visible.length} / ${rows.length}` : `${rows.length}`
      }
      bodyClassName="p-0 overflow-hidden"
    >
      <ul className="pb-1.5">
        {groups.map((group) => (
          <Fragment key={group.date}>
            <li className="sticky top-0 z-10 mb-1.5 border-b border-line bg-surface/95 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-2xs font-medium tracking-wide text-faint uppercase">
                {formatDate(group.date, locale)}
              </span>
            </li>
            {group.rows.map((row) => (
              <li key={row.id} className="px-1.5">
                <Link
                  href={`/finance/${row.id}`}
                  className="row-hover row-comfortable flex items-center gap-3"
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
      {hasMore && (
        <div className="border-t border-line p-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            {t("finance.showMore", {
              count: Math.min(PAGE_SIZE, rows.length - visible.length),
            })}
          </Button>
        </div>
      )}
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
