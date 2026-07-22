"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { MachinesPanel } from "@/components/equipment/machines-panel";
import { MaintenancePanel } from "@/components/equipment/maintenance-panel";
import { ReorderPanel } from "@/components/equipment/reorder-panel";
import { SuppliesPanel } from "@/components/equipment/supplies-panel";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { isLowStock } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Machine, MaintenanceLog, Supply } from "@/lib/types";

export function EquipmentPanels({
  machines,
  logs,
  supplies,
  spendByMachine,
}: {
  machines: Machine[];
  logs: MaintenanceLog[];
  supplies: Supply[];
  spendByMachine: Record<string, number>;
}) {
  const { t } = useI18n();

  // Counts on tabs are the things that NEED you — not totals. A badge counting
  // healthy machines would nag about nothing.
  const needAttention = machines.filter(
    (m) => m.status === "needs_attention" || m.status === "broken"
  ).length;
  const lowCount = supplies.filter(isLowStock).length;

  return (
    <TabbedPanels
      title={t("equipment.title")}
      description={t("equipment.subtitle")}
      tabs={[
        {
          id: "machines",
          label: t("equipment.machines"),
          count: needAttention,
          action: (
            <Link href="/equipment/machines/new">
              <Button
                size="sm"
                variant="primary"
                icon={<Plus aria-hidden className="size-3.5" />}
              >
                {t("equipment.newMachine")}
              </Button>
            </Link>
          ),
          content: (
            <MachinesPanel
              machines={machines}
              logs={logs}
              spendByMachine={spendByMachine}
            />
          ),
        },
        {
          id: "supplies",
          label: t("equipment.supplies"),
          count: lowCount,
          action: (
            <Link href="/equipment/supplies/new">
              <Button
                size="sm"
                variant="primary"
                icon={<Plus aria-hidden className="size-3.5" />}
              >
                {t("equipment.newSupply")}
              </Button>
            </Link>
          ),
          content: <SuppliesPanel supplies={supplies} />,
        },
        {
          id: "reorder",
          label: t("equipment.reorder"),
          count: lowCount,
          content: <ReorderPanel supplies={supplies} />,
        },
        {
          id: "maintenance",
          label: t("equipment.maintenance"),
          content: <MaintenancePanel logs={logs} machines={machines} />,
        },
      ]}
    />
  );
}
