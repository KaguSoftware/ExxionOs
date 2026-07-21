"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ClientDirectory } from "@/components/clients/directory";
import { ClientInsights } from "@/components/clients/insights";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { goneQuiet, revenueByClient, type ClientOrderRow } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import type { Client, Transaction } from "@/lib/types";

export type ClientRevenueRow = Pick<
  Transaction,
  "source_id" | "direction" | "amount_minor" | "occurred_on"
>;

export function ClientPanels({
  clients,
  orders,
  revenue,
  today,
}: {
  clients: Client[];
  orders: ClientOrderRow[];
  revenue: ClientRevenueRow[];
  /**
   * ⚠️ Stamped on the server — see the call site in `(app)/clients/page.tsx`.
   * "Gone quiet" is measured in days from today, and `react-hooks/purity` is an
   * error here precisely so that figure can't drift between re-renders.
   */
  today: string;
}) {
  const { t } = useI18n();

  /**
   * ⚠️ Money received per client, joined transaction → order → client. Built
   * ONCE here and handed to both tabs rather than recomputed in each.
   * Never `orders.total_minor` — see the header of `lib/clients.ts`.
   */
  const revenueMap = useMemo(
    () => revenueByClient(orders, revenue),
    [orders, revenue]
  );

  /**
   * The tab badge counts what NEEDS YOU — regulars who have gone quiet. A badge
   * counting healthy clients would nag about nothing, which is how people learn
   * to ignore badges.
   */
  const needsYou = useMemo(
    () => goneQuiet(clients, orders, revenueMap, today).length,
    [clients, orders, revenueMap, today]
  );

  const newClientAction = (
    <Link href="/clients/new">
      <Button
        size="sm"
        variant="primary"
        icon={<Plus aria-hidden className="size-3.5" />}
      >
        {t("clients.newClient")}
      </Button>
    </Link>
  );

  return (
    <TabbedPanels
      title={t("clients.title")}
      description={t("clients.subtitle")}
      tabs={[
        {
          id: "directory",
          label: t("clients.tabDirectory"),
          count: needsYou,
          action: newClientAction,
          content: (
            <ClientDirectory
              clients={clients}
              orders={orders}
              revenue={revenueMap}
              today={today}
            />
          ),
        },
        {
          id: "insights",
          label: t("clients.tabInsights"),
          action: newClientAction,
          content: (
            <ClientInsights
              clients={clients}
              orders={orders}
              revenue={revenueMap}
              today={today}
            />
          ),
        },
      ]}
    />
  );
}
