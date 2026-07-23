"use client";

import { Clock, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY, printQueue } from "@/lib/shipping";
import type { Client, Order, OrderLine } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * The print queue: open orders, estimated print hours, and their promised
 * dates. Honest by design — it reports hours needed and flags overdue orders,
 * but never claims you will or won't make a deadline (see `printQueue`).
 */
export function OrderQueue({
  orders,
  clientsById,
  linesByOrder,
  productHours,
  today,
}: {
  orders: Order[];
  clientsById: Map<string, Client>;
  linesByOrder: Map<string, OrderLine[]>;
  productHours: Map<string, number | null>;
  today: string;
}) {
  const { t, locale } = useI18n();

  const rows = useMemo(
    () =>
      printQueue(
        orders,
        linesByOrder,
        productHours,
        (id) => (id ? (clientsById.get(id)?.name ?? null) : null),
        today
      ),
    [orders, linesByOrder, productHours, clientsById, today]
  );

  const totalHours = useMemo(
    () => rows.reduce((sum, r) => sum + (r.estHours ?? 0), 0),
    [rows]
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Printer aria-hidden className="size-4" />}
        title={t("shipping.queueEmpty")}
        description={t("shipping.queueEmptyHint")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Clock aria-hidden className="size-4 text-faint" />
        {t("shipping.queueTotalHours", {
          hours: Math.round(totalHours * 10) / 10,
        })}
      </div>

      <ul className="overflow-hidden rounded-xl border border-line">
        {rows.map((row) => (
          <li
            key={row.orderId}
            className="flex flex-wrap items-center gap-3 row-comfortable border-b border-line last:border-0"
          >
            <Link
              href={`/shipping/orders/${row.orderId}`}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm text-ink">
                {row.code ? `${row.code} · ` : ""}
                {row.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {row.clientName && <span>{row.clientName}</span>}
                <Badge>{t(STAGE_KEY[row.stage] as never)}</Badge>
                {row.uncostedLines > 0 && (
                  <span className="text-faint">
                    {t("shipping.queueUncosted", { count: row.uncostedLines })}
                  </span>
                )}
              </p>
            </Link>

            <div className="shrink-0 text-end">
              <p className="tnum text-sm text-ink">
                {row.estHours == null
                  ? "—"
                  : t("shipping.queueHours", { hours: row.estHours })}
              </p>
              {row.promisedOn && (
                <p
                  className={
                    row.overdue
                      ? "mt-0.5 text-xs text-danger"
                      : "mt-0.5 text-xs text-muted"
                  }
                >
                  {row.overdue && (
                    <span className="me-1">{t("shipping.queueOverdue")}</span>
                  )}
                  {formatDate(row.promisedOn, locale)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
