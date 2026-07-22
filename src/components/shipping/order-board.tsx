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
import type { BoardLane } from "@/lib/shipping";
import { BOARD_LANES, STAGE_KEY, outstandingMinor } from "@/lib/shipping";
import { useAction } from "@/lib/use-action";
import { cn, formatMinor } from "@/lib/utils";

/** The opt-in cancelled lane — an exit, not a step, so it's shown on demand. */
const CANCELLED_LANE: BoardLane = {
  id: "cancelled",
  labelKey: "shipping.stageCancelled",
  stages: ["cancelled"],
  entry: "cancelled",
};

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
  const [overLane, setOverLane] = useState<string | null>(null);
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

  const lanes = showCancelled ? [...BOARD_LANES, CANCELLED_LANE] : BOARD_LANES;

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

  /**
   * What the board is worth, and what of it is still owed.
   *
   * ⚠️ `delivered` is excluded from the pipeline figure — it has left the
   * pipeline. Including it would make the number grow forever and stop meaning
   * "work in hand". Money still OWED on delivered orders is counted though,
   * because that is exactly the money most at risk of being forgotten.
   */
  const openOrders = orders.filter(
    (o) => o.stage !== "cancelled" && o.stage !== "delivered"
  );
  const pipelineMinor = openOrders.reduce((sum, o) => sum + o.total_minor, 0);
  const owedMinor = orders
    .filter((o) => o.stage !== "cancelled")
    .reduce(
      (sum, o) => sum + outstandingMinor(o, paymentsByOrder.get(o.id) ?? []),
      0
    );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {pipelineMinor > 0 && (
          <Figure label={t("shipping.inPipeline")} value={formatMinor(pipelineMinor)} />
        )}
        {owedMinor > 0 && (
          <Figure
            label={t("shipping.stillOwed")}
            value={formatMinor(owedMinor)}
            tone="owed"
          />
        )}

        {cancelledCount > 0 && (
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className="ms-auto rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {showCancelled
              ? t("shipping.hideCancelled")
              : t("shipping.showCancelled")}
          </button>
        )}
      </div>

      {/* Four lanes that FIT the viewport — no sideways scroll, so a card's
          stage dropdown can open without an overflow container clipping it.
          The lanes are a display grouping; the 8 real stages live underneath
          (see BOARD_LANES in lib/shipping.ts). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:auto-cols-fr xl:grid-flow-col">
        {lanes.map((lane) => {
          const column = orders
            .filter((o) => lane.stages.includes(o.stage))
            .sort((a, b) => a.stage.localeCompare(b.stage));
          const columnValue = column.reduce((sum, o) => sum + o.total_minor, 0);
          return (
            <section
              key={lane.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverLane(lane.id);
              }}
              onDragLeave={() => setOverLane((l) => (l === lane.id ? null : l))}
              onDrop={(e) => {
                e.preventDefault();
                setOverLane(null);
                const order = orders.find((o) => o.id === dragging);
                setDragging(null);
                // Dropping onto a lane moves the order to that lane's ENTRY
                // stage; the card dropdown sets a finer stage when needed.
                if (order && !lane.stages.includes(order.stage)) {
                  void move(order, lane.entry);
                }
              }}
              className={cn(
                // ⚠️ NOT overflow-hidden: each card holds a Dropdown whose menu
                // is absolutely positioned and would be clipped (the exact bug
                // that shipped once already). The header rounds its own top
                // corners instead — see below.
                "flex min-w-0 flex-col rounded-xl border bg-surface transition-colors",
                overLane === lane.id ? "border-brand bg-brand-soft" : "border-line"
              )}
            >
              {/* ⚠️ THE LANE CARRIES ITS VALUE, not just its count. "Six orders
                  in production" and "₺40,000 in production" are different facts,
                  and only the second tells you what a stalled lane is costing. */}
              <header className="row-compact border-b border-line">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink">
                    {t(lane.labelKey as never)}
                  </span>
                  <span className="tnum text-2xs text-faint">{column.length}</span>
                </div>
                {columnValue > 0 && (
                  <p className="tnum mt-0.5 text-2xs text-muted">
                    {formatMinor(columnValue)}
                  </p>
                )}
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
                        order.stage !== "delivered";

                      return (
                        <article
                          key={order.id}
                          draggable
                          onDragStart={() => setDragging(order.id)}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverLane(null);
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
                            {order.stage === "delivered" && owed > 0 && (
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

/**
 * One figure in the board summary.
 *
 * ⚠️ `owed` uses the RESERVED warning colour for its real meaning — money not
 * yet collected — and pairs it with a word, never colour alone.
 */
function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "owed";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-faint">{label}</span>
      <span
        className={cn(
          "tnum text-sm font-medium",
          tone === "owed" ? "text-warning" : "text-ink"
        )}
      >
        {value}
      </span>
    </span>
  );
}
