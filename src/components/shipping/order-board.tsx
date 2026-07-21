"use client";

import { PackageOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BalancePrompt } from "@/components/shipping/balance-prompt";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { setOrderStage } from "@/lib/actions/shipping";
import { useI18n } from "@/lib/i18n/client";
import { ORDER_STAGES } from "@/lib/types";
import type { Client, Order, OrderPayment, OrderStage } from "@/lib/types";
import { STAGE_KEY, outstandingMinor } from "@/lib/shipping";
import { useAction } from "@/lib/use-action";
import { cn, formatMinor } from "@/lib/utils";

/** Columns shown by default. `cancelled` is opt-in — it is an exit, not a step. */
const BOARD_STAGES: OrderStage[] = [
  "enquiry",
  "quoted",
  "printing",
  "post_processing",
  "packed",
  "shipped",
  "delivered",
];

export function OrderBoard({
  orders: initial,
  clientsById,
  paymentsByOrder,
  today,
}: {
  orders: Order[];
  clientsById: Map<string, Client>;
  paymentsByOrder: Map<string, OrderPayment[]>;
  /** From the server — never computed during render (`react-hooks/purity`). */
  today: string;
}) {
  const { t } = useI18n();
  const { run } = useAction();

  const [orders, setOrders] = useState(initial);
  const [showCancelled, setShowCancelled] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<OrderStage | null>(null);
  /** Set when an order has just reached `delivered` with money still owed. */
  const [balanceFor, setBalanceFor] = useState<{
    order: Order;
    outstandingMinor: number;
  } | null>(null);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setOrders(initial);
  }

  const move = async (order: Order, stage: OrderStage) => {
    if (order.stage === stage) return;
    const previous = orders;

    const result = await run(() => setOrderStage(order.id, stage), {
      optimistic: () =>
        setOrders((list) =>
          list.map((o) => (o.id === order.id ? { ...o, stage } : o))
        ),
      rollback: () => setOrders(previous),
      errorMessage: t("shipping.saveFailed"),
    });

    /**
     * ⚠️ THE DEPOSIT-SAFE PROMPT. The action returns what is STILL OWED — the
     * total minus everything already received — so the dialog can never ask for
     * money that has already been banked. If the order is paid in full it
     * reports that instead of offering to write a second income row.
     */
    if (result.ok && result.data.justDelivered) {
      setBalanceFor({ order, outstandingMinor: result.data.outstandingMinor });
    }
  };

  const stages = showCancelled ? [...BOARD_STAGES, "cancelled" as const] : BOARD_STAGES;
  const visible = showCancelled
    ? orders
    : orders.filter((o) => o.stage !== "cancelled");

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen aria-hidden className="size-4" />}
        title={t("shipping.noOrders")}
        description={t("shipping.noOrdersHint")}
      />
    );
  }

  const cancelledCount = orders.filter((o) => o.stage === "cancelled").length;

  return (
    <>
      <div className="mb-3 flex justify-end">
        {cancelledCount > 0 && (
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {showCancelled
              ? t("shipping.hideCancelled")
              : t("shipping.showCancelled")}
          </button>
        )}
      </div>

      {/* The board scrolls horizontally inside its own container; the page
          itself must never scroll sideways. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-3">
          {stages.map((stage) => {
            const column = visible.filter((o) => o.stage === stage);
            return (
              <section
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  const order = orders.find((o) => o.id === dragging);
                  setDragging(null);
                  if (order) void move(order, stage);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col rounded-xl border bg-surface transition-colors",
                  overStage === stage
                    ? "border-brand bg-brand-soft"
                    : "border-line"
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <span className="text-xs font-medium text-ink">
                    {t(STAGE_KEY[stage] as never)}
                  </span>
                  <span className="tnum text-2xs text-faint">{column.length}</span>
                </header>

                <div className="flex flex-1 flex-col gap-2 p-2">
                  {column.length === 0 ? (
                    <p className="px-1 py-6 text-center text-2xs text-faint">
                      {t("shipping.emptyStage")}
                    </p>
                  ) : (
                    column.map((order) => {
                      const client = order.client_id
                        ? clientsById.get(order.client_id)
                        : null;
                      const owed = outstandingMinor(
                        order,
                        paymentsByOrder.get(order.id) ?? []
                      );
                      const overdue =
                        !!order.promised_on &&
                        order.promised_on < today &&
                        stage !== "delivered";

                      return (
                        <article
                          key={order.id}
                          draggable
                          onDragStart={() => setDragging(order.id)}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverStage(null);
                          }}
                          className={cn(
                            "rounded-lg border border-line bg-raised p-2.5",
                            "transition-opacity",
                            dragging === order.id && "opacity-50"
                          )}
                        >
                          <Link
                            href={`/shipping/orders/${order.id}`}
                            className="block rounded text-sm text-ink hover:text-brand-text"
                          >
                            <span className="line-clamp-2 leading-snug">
                              {order.code ? `${order.code} · ` : ""}
                              {order.title}
                            </span>
                          </Link>

                          {client && (
                            <p className="mt-0.5 truncate text-2xs text-faint">
                              {client.name}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {order.total_minor > 0 && (
                              <span className="tnum text-2xs text-muted">
                                {formatMinor(order.total_minor)}
                              </span>
                            )}
                            {/* Word + tone, never colour alone. */}
                            {overdue && (
                              <Badge tone="danger">{t("shipping.overdue")}</Badge>
                            )}
                            {stage === "delivered" && owed > 0 && (
                              <Badge tone="warning">
                                {t("shipping.unpaidDelivered")}
                              </Badge>
                            )}
                          </div>

                          {/* ⚠️ THE KEYBOARD PATH. Dragging is a convenience; a
                              board that can ONLY be dragged is unusable without
                              a mouse and invisible to a screen reader. This
                              dropdown is the real control. */}
                          <div className="mt-2">
                            <Dropdown
                              value={order.stage}
                              onChange={(v) => void move(order, v as OrderStage)}
                              options={ORDER_STAGES.map((s) => ({
                                value: s,
                                label: t(STAGE_KEY[s] as never),
                              }))}
                              label={`${t("shipping.moveTo")} — ${order.title}`}
                              placeholder={t("shipping.stage")}
                              className="w-full"
                            />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {balanceFor && (
        <BalancePrompt
          order={balanceFor.order}
          outstandingMinor={balanceFor.outstandingMinor}
          onClose={() => setBalanceFor(null)}
        />
      )}
    </>
  );
}
