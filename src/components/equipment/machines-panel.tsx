"use client";

import { HardDrive, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { setMachineStatus } from "@/lib/actions/equipment";
import { STATUS_KEY, STATUS_RANK, STATUS_TONE } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Machine, MachineStatus, MaintenanceLog } from "@/lib/types";
import { MACHINE_STATUSES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, formatMinor } from "@/lib/utils";

export function MachinesPanel({
  machines: initial,
  logs,
  spendByMachine,
}: {
  machines: Machine[];
  logs: MaintenanceLog[];
  /** Totals from FINANCE — never summed from the logs. */
  spendByMachine: Record<string, number>;
}) {
  const { t, locale } = useI18n();
  const { run } = useAction();

  const [machines, setMachines] = useState(initial);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setMachines(initial);
  }

  const setStatus = (machine: Machine, status: MachineStatus) => {
    const previous = machines;
    void run(() => setMachineStatus(machine.id, status), {
      // Optimistic: marking something broken should feel instant — you're
      // usually standing at the machine when you do it.
      optimistic: () =>
        setMachines((list) =>
          list.map((m) => (m.id === machine.id ? { ...m, status } : m))
        ),
      rollback: () => setMachines(previous),
      errorMessage: t("equipment.saveFailed"),
    });
  };

  if (machines.length === 0) {
    return (
      <EmptyState
        icon={<HardDrive aria-hidden className="size-4" />}
        title={t("equipment.noMachines")}
        description={t("equipment.noMachinesHint")}
      />
    );
  }

  // Broken and needs-attention first: the list leads with what needs you.
  const sorted = [...machines].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name)
  );

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((machine) => {
        const machineLogs = logs.filter((l) => l.machine_id === machine.id);
        const last = machineLogs[0] ?? null;
        const spent = spendByMachine[machine.id] ?? 0;

        return (
          <li
            key={machine.id}
            className={cn(
              "flex flex-col rounded-xl border bg-surface p-4",
              machine.status === "broken" ? "border-danger/40" : "border-line"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/equipment/machines/${machine.id}`}
                className="min-w-0 flex-1"
              >
                <h3 className="truncate text-sm font-medium text-ink hover:underline">
                  {machine.name}
                </h3>
                {machine.kind && (
                  <p className="truncate text-xs text-muted">{machine.kind}</p>
                )}
              </Link>
              <Badge tone={STATUS_TONE[machine.status]}>
                {t(STATUS_KEY[machine.status] as never)}
              </Badge>
            </div>

            <dl className="mt-3 flex flex-col gap-1 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">{t("equipment.lastService")}</dt>
                <dd className="text-ink">
                  {last ? (
                    formatDate(last.performed_on, locale)
                  ) : (
                    <span className="text-faint">
                      {t("equipment.neverServiced")}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">{t("equipment.totalSpent")}</dt>
                {/* Read from Finance. See the page's query comment. */}
                <dd className="tnum text-ink">{formatMinor(spent)}</dd>
              </div>
            </dl>

            {/* Inline status — "if the sanding machine is broken we can mark it
                there". One click, from the list, no navigation. */}
            <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2">
              {MACHINE_STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(machine, value)}
                  aria-pressed={machine.status === value}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-2xs transition-colors",
                    machine.status === value
                      ? "border-brand bg-brand-soft text-ink"
                      : "border-line text-muted hover:text-ink"
                  )}
                >
                  {t(STATUS_KEY[value] as never)}
                </button>
              ))}
            </div>

            <Link
              href={`/equipment/machines/${machine.id}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <Wrench aria-hidden className="size-3" />
              {t("equipment.logMaintenance")}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
