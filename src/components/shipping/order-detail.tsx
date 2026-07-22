"use client";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BalancePrompt } from "@/components/shipping/balance-prompt";
import { OrderForm, type ProductOption } from "@/components/shipping/order-form";
import { PaymentForm } from "@/components/shipping/payment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { deleteOrder, deletePayment, setOrderStage } from "@/lib/actions/shipping";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY, outstandingMinor, paidMinor } from "@/lib/shipping";
import { ORDER_STAGES } from "@/lib/types";
import type {
  Client,
  Order,
  OrderLine,
  OrderPayment,
  OrderStage,
  OrderStageEvent,
} from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, formatDateTime, formatMinor } from "@/lib/utils";

const KIND_KEY: Record<OrderPayment["kind"], string> = {
  deposit: "shipping.kindDeposit",
  balance: "shipping.kindBalance",
  refund: "shipping.kindRefund",
};

export function OrderDetail({
  order: initialOrder,
  lines,
  payments: initialPayments,
  events,
  clients,
  products,
}: {
  order: Order;
  lines: OrderLine[];
  payments: OrderPayment[];
  events: OrderStageEvent[];
  clients: Client[];
  products: ProductOption[];
}) {
  const { t, locale } = useI18n();
  const { run } = useAction();
  const router = useRouter();

  const [order, setOrder] = useState(initialOrder);
  const [payments, setPayments] = useState(initialPayments);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingPayment, setRemovingPayment] = useState<OrderPayment | null>(null);
  const [balanceFor, setBalanceFor] = useState<number | null>(null);

  // Server truth adopted during render, never in an effect.
  const [seenOrder, setSeenOrder] = useState(initialOrder);
  if (seenOrder !== initialOrder) {
    setSeenOrder(initialOrder);
    setOrder(initialOrder);
  }
  const [seenPayments, setSeenPayments] = useState(initialPayments);
  if (seenPayments !== initialPayments) {
    setSeenPayments(initialPayments);
    setPayments(initialPayments);
  }

  // Sort in the component, newest-first, rather than trusting the query's
  // order — a timeline whose direction depends on a distant `.order()` clause
  // is one refactor away from silently reversing. Matches the schedule and
  // client timelines, which also read newest-first.
  const timeline = useMemo(
    () => [...events].sort((a, b) => b.entered_at.localeCompare(a.entered_at)),
    [events]
  );

  const received = paidMinor(payments);
  const owed = outstandingMinor(order, payments);
  const client = clients.find((c) => c.id === order.client_id) ?? null;

  const move = async (stage: OrderStage) => {
    if (stage === order.stage) return;
    const previous = order;
    const result = await run(() => setOrderStage(order.id, stage), {
      optimistic: () => setOrder((o) => ({ ...o, stage })),
      rollback: () => setOrder(previous),
      errorMessage: t("shipping.saveFailed"),
    });
    // Same deposit-safe prompt as the board: the amount is what is STILL owed.
    if (result.ok && result.data.justDelivered) {
      setBalanceFor(result.data.outstandingMinor);
    }
  };

  const removePayment = async (payment: OrderPayment) => {
    const previous = payments;
    setRemovingPayment(null);
    await run(() => deletePayment(payment.id, order.id), {
      optimistic: () =>
        setPayments((list) => list.filter((p) => p.id !== payment.id)),
      rollback: () => setPayments(previous),
      successMessage: t("shipping.deleted"),
      errorMessage: t("shipping.saveFailed"),
    });
  };

  const remove = async () => {
    setConfirmDelete(false);
    const result = await run(() => deleteOrder(order.id), {
      successMessage: t("shipping.deleted"),
      errorMessage: t("shipping.saveFailed"),
    });
    if (result.ok) router.push("/shipping");
  };

  if (editing) {
    return (
      <div className="animate-fade-rise mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("common.back")}
        </button>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
          {t("shipping.editOrder")}
        </h1>
        <OrderForm
          order={order}
          lines={lines}
          clients={clients}
          products={products}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-rise mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
      <Link
        href="/shipping"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("shipping.title")}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {order.code ? `${order.code} · ` : ""}
            {order.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {client?.name ?? t("shipping.noClient")}
            {order.promised_on &&
              ` · ${t("shipping.duePromised", {
                date: formatDate(order.promised_on, locale),
              })}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The stage control — keyboard-reachable here as on the board. */}
          <Dropdown
            value={order.stage}
            onChange={(v) => void move(v as OrderStage)}
            options={ORDER_STAGES.map((s) => ({
              value: s,
              label: t(STAGE_KEY[s] as never),
            }))}
            label={t("shipping.moveTo")}
            placeholder={t("shipping.stage")}
            className="w-44"
          />
          <Button
            size="sm"
            onClick={() => setEditing(true)}
            icon={<Pencil aria-hidden className="size-3.5" />}
          >
            {t("common.edit")}
          </Button>
        </div>
      </header>

      {/* --- money strip ---------------------------------------------------- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Figure label={t("shipping.total")} value={formatMinor(order.total_minor)} />
        <Figure label={t("shipping.paid")} value={formatMinor(received)} />
        <Figure
          label={t("shipping.outstanding")}
          value={formatMinor(owed)}
          tone={owed > 0 ? "warning" : "success"}
          note={owed === 0 && order.total_minor > 0 ? t("shipping.fullyPaid") : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- items -------------------------------------------------------- */}
        <Panel title={t("shipping.lines")}>
          {lines.length === 0 ? (
            <EmptyState
              title={t("shipping.noLines")}
              description={t("shipping.noLinesHint")}
            />
          ) : (
            <ul className="flex flex-col">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center gap-2 border-b border-line py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{line.description}</p>
                    <p className="tnum mt-0.5 text-2xs text-faint">
                      {line.quantity} × {formatMinor(line.unit_price_minor)}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-sm text-muted">
                    {formatMinor(line.quantity * line.unit_price_minor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --- payments ----------------------------------------------------- */}
        <Panel
          title={t("shipping.payments")}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => setPaying(true)}
              icon={<Plus aria-hidden className="size-3.5" />}
            >
              {t("shipping.recordPayment")}
            </Button>
          }
        >
          {payments.length === 0 ? (
            <EmptyState
              title={t("shipping.noPayments")}
              description={t("shipping.noPaymentsHint")}
            />
          ) : (
            <ul className="flex flex-col">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="group flex items-center gap-2 border-b border-line py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-sm text-ink">
                        {/* A refund is money going the other way — the sign is
                            the secondary encoding, not the colour. */}
                        {payment.kind === "refund" ? "−" : "+"}
                        {formatMinor(payment.amount_minor)}
                      </span>
                      <Badge>{t(KIND_KEY[payment.kind] as never)}</Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-faint">
                      {formatDate(payment.paid_on, locale)}
                      {!payment.transaction_id && " · —"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemovingPayment(payment)}
                    aria-label={t("shipping.deletePayment")}
                    className="rounded p-1.5 text-faint opacity-0 transition-[color,opacity] group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* --- timeline ------------------------------------------------------- */}
      <Panel title={t("shipping.timeline")} className="mt-4">
        {timeline.length === 0 ? (
          <EmptyState title={t("shipping.notEnoughData")} />
        ) : (
          <ol className="flex flex-col">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline gap-3 border-b border-line py-2 last:border-0"
              >
                <span className="text-sm text-ink">
                  {t("shipping.enteredStage", {
                    stage: t(STAGE_KEY[event.stage] as never),
                  })}
                </span>
                <span className="ms-auto shrink-0 text-2xs text-faint">
                  {formatDateTime(event.entered_at, locale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {(order.carrier || order.tracking_number) && (
        <Panel title={t("shipping.carrier")} className="mt-4">
          <p className="text-sm text-ink">{order.carrier}</p>
          {order.tracking_number && (
            <p className="mt-1 text-xs text-muted">{order.tracking_number}</p>
          )}
        </Panel>
      )}

      {order.notes && (
        <Panel title={t("shipping.notes")} className="mt-4">
          <p className="text-sm whitespace-pre-wrap text-muted">{order.notes}</p>
        </Panel>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          icon={<Trash2 aria-hidden className="size-3.5" />}
        >
          {t("shipping.deleteOrder")}
        </Button>
      </div>

      {paying && (
        <PaymentForm
          orderId={order.id}
          suggestedMinor={owed}
          hasPayments={payments.length > 0}
          onClose={() => setPaying(false)}
        />
      )}

      {balanceFor != null && (
        <BalancePrompt
          order={order}
          outstandingMinor={balanceFor}
          onClose={() => setBalanceFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t("shipping.deleteOrder")}
        body={t("shipping.deleteOrderConfirm")}
        confirmLabel={t("common.delete")}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={!!removingPayment}
        title={t("shipping.deletePayment")}
        body={t("shipping.deletePaymentConfirm")}
        confirmLabel={t("common.delete")}
        onConfirm={() => removingPayment && void removePayment(removingPayment)}
        onCancel={() => setRemovingPayment(null)}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success";
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-lg font-semibold",
          tone === "warning" ? "text-warning" : "text-ink"
        )}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-2xs text-success">{note}</p>}
    </div>
  );
}
