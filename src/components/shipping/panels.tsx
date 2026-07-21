"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { OrderBoard } from "@/components/shipping/order-board";
import { OrderList } from "@/components/shipping/order-list";
import { ShippingInsights } from "@/components/shipping/insights";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { isTerminal, outstandingMinor } from "@/lib/shipping";
import type {
  Client,
  Order,
  OrderLine,
  OrderPayment,
  OrderStageEvent,
  Transaction,
} from "@/lib/types";

export type RevenueRow = Pick<
  Transaction,
  "occurred_on" | "direction" | "amount_minor"
>;

export function ShippingPanels({
  orders,
  clients,
  lines,
  payments,
  stageEvents,
  revenue,
  today,
}: {
  orders: Order[];
  clients: Client[];
  lines: OrderLine[];
  payments: OrderPayment[];
  stageEvents: OrderStageEvent[];
  revenue: RevenueRow[];
  /**
   * ⚠️ Passed from the server, never computed during render — see the note at
   * the call site in `(app)/shipping/page.tsx`.
   */
  today: string;
}) {
  const { t } = useI18n();

  // Group once, here, rather than filtering the full arrays inside every card.
  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, OrderPayment[]>();
    for (const p of payments) {
      const list = map.get(p.order_id);
      if (list) list.push(p);
      else map.set(p.order_id, [p]);
    }
    return map;
  }, [payments]);

  const linesByOrder = useMemo(() => {
    const map = new Map<string, OrderLine[]>();
    for (const l of lines) {
      const list = map.get(l.order_id);
      if (list) list.push(l);
      else map.set(l.order_id, [l]);
    }
    return map;
  }, [lines]);

  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  /**
   * The tab badge counts what NEEDS you: orders past their promised date, and
   * orders delivered but not paid for. A badge counting healthy orders would
   * nag about nothing.
   */
  const needsYou = useMemo(
    () =>
      orders.filter((o) => {
        if (o.stage === "cancelled") return false;
        const owed = outstandingMinor(o, paymentsByOrder.get(o.id) ?? []);
        if (o.stage === "delivered") return owed > 0;
        return !!o.promised_on && o.promised_on < today && !isTerminal(o.stage);
      }).length,
    [orders, paymentsByOrder, today]
  );

  const newOrderAction = (
    <Link href="/shipping/orders/new">
      <Button
        size="sm"
        variant="primary"
        icon={<Plus aria-hidden className="size-3.5" />}
      >
        {t("shipping.newOrder")}
      </Button>
    </Link>
  );

  return (
    <TabbedPanels
      title={t("shipping.title")}
      description={t("shipping.subtitle")}
      tabs={[
        {
          id: "board",
          label: t("shipping.tabBoard"),
          count: needsYou,
          action: newOrderAction,
          content: (
            <OrderBoard
              orders={orders}
              clientsById={clientsById}
              paymentsByOrder={paymentsByOrder}
              today={today}
            />
          ),
        },
        {
          id: "list",
          label: t("shipping.tabList"),
          action: newOrderAction,
          content: (
            <OrderList
              orders={orders}
              clients={clients}
              clientsById={clientsById}
              linesByOrder={linesByOrder}
              paymentsByOrder={paymentsByOrder}
              today={today}
            />
          ),
        },
        {
          id: "insights",
          label: t("shipping.tabInsights"),
          content: (
            <ShippingInsights
              orders={orders}
              stageEvents={stageEvents}
              revenue={revenue}
              today={today}
            />
          ),
        },
      ]}
    />
  );
}
