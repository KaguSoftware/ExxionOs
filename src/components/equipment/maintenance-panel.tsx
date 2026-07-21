"use client";

import { Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import type { Machine, MaintenanceKind, MaintenanceLog } from "@/lib/types";
import { MAINTENANCE_KINDS } from "@/lib/types";
import { formatDate, formatMinor } from "@/lib/utils";

export const KIND_KEY: Record<MaintenanceKind, string> = {
  repair: "equipment.repair",
  service: "equipment.service",
  part: "equipment.part",
  inspection: "equipment.inspection",
};

export function MaintenancePanel({
  logs,
  machines,
}: {
  logs: MaintenanceLog[];
  machines: Machine[];
}) {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<MaintenanceKind | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);

  // Client-side filtering over rows already in memory — no round-trip.
  const visible = logs.filter(
    (log) =>
      (!kind || log.kind === kind) && (!machineId || log.machine_id === machineId)
  );

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<Wrench aria-hidden className="size-4" />}
        title={t("equipment.noMaintenance")}
        description={t("equipment.noMaintenanceHint")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={kind === null && machineId === null} onClick={() => {
          setKind(null);
          setMachineId(null);
        }}>
          {t("creative.allIssues")}
        </FilterChip>
        {MAINTENANCE_KINDS.map((value) => (
          <FilterChip
            key={value}
            active={kind === value}
            onClick={() => setKind(kind === value ? null : value)}
          >
            {t(KIND_KEY[value] as never)}
          </FilterChip>
        ))}
        {machines.length > 1 &&
          machines.map((machine) => (
            <FilterChip
              key={machine.id}
              active={machineId === machine.id}
              onClick={() =>
                setMachineId(machineId === machine.id ? null : machine.id)
              }
            >
              {machine.name}
            </FilterChip>
          ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <ul className="rounded-xl border border-line">
          {visible.map((log) => {
            const machine = machines.find((m) => m.id === log.machine_id);
            return (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {log.description || t(KIND_KEY[log.kind] as never)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {machine && (
                      <Link
                        href={`/equipment/machines/${machine.id}`}
                        className="hover:underline"
                      >
                        {machine.name}
                      </Link>
                    )}
                    <span aria-hidden>·</span>
                    <span>{formatDate(log.performed_on, locale)}</span>
                    <Badge>{t(KIND_KEY[log.kind] as never)}</Badge>
                    {/* Makes the Finance link visible: this row created a real
                        expense, and you can tell at a glance. */}
                    {log.transaction_id && (
                      <Badge tone="accent">{t("equipment.loggedInFinance")}</Badge>
                    )}
                  </p>
                </div>

                {log.cost_minor != null && (
                  <span className="tnum shrink-0 text-sm text-danger">
                    −{formatMinor(log.cost_minor)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
