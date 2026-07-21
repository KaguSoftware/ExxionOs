"use client";

import { PackageOpen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY, STAGE_RANK, isTerminal, outstandingMinor } from "@/lib/shipping";
import { ORDER_STAGES } from "@/lib/types";
import type { Client, Order, OrderLine, OrderPayment } from "@/lib/types";
import { formatDate, formatMinor } from "@/lib/utils";

/**
 * ⚠️ FILTERING IS 100% CLIENT-SIDE over rows already in memory. Every order is
 * already here from the page's single wave; a server round-trip per filter
 * change would trade ~3ms for ~305ms and gain nothing.
 */
export function OrderList({
  orders,
  clients,
  clientsById,
  linesByOrder,
  paymentsByOrder,
  today,
}: {
  orders: Order[];
  clients: Client[];
  clientsById: Map<string, Client>;
  linesByOrder: Map<string, OrderLine[]>;
  paymentsByOrder: Map<string, OrderPayment[]>;
  /** From the server — never computed during render (`react-hooks/purity`). */
  today: string;
}) {
  const { t, locale } = useI18n();

  const [stage, setStage] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

  const filtered = useMemo(() => {
    const rows = orders.filter(
      (o) =>
        (!stage || o.stage === stage) &&
        (!clientId || o.client_id === clientId)
    );
    // Active work first, in pipeline order; finished orders sink.
    return rows.sort(
      (a, b) =>
        STAGE_RANK[a.stage] - STAGE_RANK[b.stage] ||
        (a.promised_on ?? "9999").localeCompare(b.promised_on ?? "9999")
    );
  }, [orders, stage, clientId]);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen aria-hidden className="size-4" />}
        title={t("shipping.noOrders")}
        description={t("shipping.noOrdersHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Dropdown
          value={stage}
          onChange={setStage}
          options={[
            { value: "", label: t("shipping.allStages") },
            ...ORDER_STAGES.map((s) => ({
              value: s,
              label: t(STAGE_KEY[s] as never),
              count: orders.filter((o) => o.stage === s).length,
            })),
          ]}
          label={t("shipping.stage")}
          placeholder={t("shipping.allStages")}
          className="w-44"
        />
        {clients.length > 0 && (
          <Dropdown
            value={clientId}
            onChange={setClientId}
            options={[
              { value: "", label: t("shipping.allClients") },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
            label={t("shipping.client")}
            placeholder={t("shipping.allClients")}
            className="w-48"
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("shipping.noOrders")} />
      ) : (
        <ul className="rounded-xl border border-line">
          {filtered.map((order) => {
            const client = order.client_id
              ? clientsById.get(order.client_id)
              : null;
            const payments = paymentsByOrder.get(order.id) ?? [];
            const owed = outstandingMinor(order, payments);
            const lineCount = (linesByOrder.get(order.id) ?? []).length;
            const overdue =
              !!order.promised_on &&
              order.promised_on < today &&
              !isTerminal(order.stage);

            return (
              <li
                key={order.id}
                className="border-b border-line last:border-0 hover:bg-raised"
              >
                <Link
                  href={`/shipping/orders/${order.id}`}
                  className="row-comfortable flex flex-wrap items-center gap-3"
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm text-ink">
                        {order.code ? `${order.code} · ` : ""}
                        {order.title}
                      </span>
                      <Badge>{t(STAGE_KEY[order.stage] as never)}</Badge>
                      {overdue && (
                        <Badge tone="danger">{t("shipping.overdue")}</Badge>
                      )}
                      {order.stage === "delivered" && owed > 0 && (
                        <Badge tone="warning">
                          {t("shipping.unpaidDelivered")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {client?.name ?? t("shipping.noClient")}
                      {lineCount > 0 && ` · ${lineCount} × ${t("shipping.lines")}`}
                      {order.promised_on &&
                        ` · ${t("shipping.duePromised", {
                          date: formatDate(order.promised_on, locale),
                        })}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="tnum text-sm text-ink">
                      {formatMinor(order.total_minor)}
                    </p>
                    {owed > 0 ? (
                      <p className="tnum text-2xs text-muted">
                        {t("shipping.outstanding")} {formatMinor(owed)}
                      </p>
                    ) : (
                      order.total_minor > 0 && (
                        <p className="text-2xs text-success">
                          {t("shipping.fullyPaid")}
                        </p>
                      )
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
