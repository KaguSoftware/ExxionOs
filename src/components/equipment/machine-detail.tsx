"use client";

import { ArrowLeft, Bell, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MaintenanceForm } from "@/components/equipment/maintenance-form";
import { KIND_KEY } from "@/components/equipment/maintenance-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Panel } from "@/components/ui/panel";
import { deleteMaintenance } from "@/lib/actions/equipment";
import { STATUS_KEY, STATUS_TONE } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Machine, MaintenanceLog, Reminder } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate, formatMinor } from "@/lib/utils";

export function MachineDetail({
  machine,
  logs: initial,
  totalSpentMinor,
  reminders,
}: {
  machine: Machine;
  logs: MaintenanceLog[];
  totalSpentMinor: number;
  reminders: Reminder[];
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();

  const [logs, setLogs] = useState(initial);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<MaintenanceLog | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceLog | null>(null);

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setLogs(initial);
  }

  const remove = (log: MaintenanceLog) => {
    const previous = logs;
    setConfirmDelete(null);
    void run(() => deleteMaintenance(log.id, machine.id), {
      optimistic: () => setLogs((list) => list.filter((l) => l.id !== log.id)),
      rollback: () => setLogs(previous),
      successMessage: t("equipment.deleted"),
      errorMessage: t("equipment.saveFailed"),
    });
  };

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <Link
        href="/equipment"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("equipment.machines")}
      </Link>

      <PageHeader
        title={machine.name}
        description={[machine.kind, machine.model, machine.location]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/equipment/machines/${machine.id}/edit`}>
              <Button size="sm" icon={<Pencil aria-hidden className="size-3.5" />}>
                {t("common.edit")}
              </Button>
            </Link>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setComposing(true)}
              icon={<Plus aria-hidden className="size-3.5" />}
            >
              {t("equipment.logMaintenance")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <Stat label={t("equipment.status")}>
          <Badge tone={STATUS_TONE[machine.status]}>
            {t(STATUS_KEY[machine.status] as never)}
          </Badge>
        </Stat>
        <Stat label={t("equipment.totalSpent")} hint={t("equipment.totalSpentHint")}>
          <span className="tnum text-lg font-semibold text-ink">
            {formatMinor(totalSpentMinor)}
          </span>
        </Stat>
        <Stat label={t("equipment.purchasedOn")}>
          <span className="text-sm text-ink">
            {machine.purchased_on
              ? formatDate(machine.purchased_on, locale)
              : "—"}
          </span>
        </Stat>
      </div>

      {reminders.length > 0 && (
        <Panel title={t("dashboard.reminders")} className="mb-4">
          <ul className="flex flex-col gap-1.5">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center gap-2 text-sm">
                <Bell aria-hidden className="size-3.5 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 text-ink">{reminder.body}</span>
                {reminder.due_on && (
                  <span className="shrink-0 text-xs text-muted">
                    {formatDate(reminder.due_on, locale)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* `p-0` in BOTH branches: EmptyState brings its own px-6 py-10, so
          keeping Panel's default padding double-padded the empty case
          relative to the populated one. */}
      <Panel title={t("equipment.maintenance")} bodyClassName="p-0">
        {logs.length === 0 ? (
          <EmptyState
            icon={<Wrench aria-hidden className="size-4" />}
            title={t("equipment.noMaintenance")}
            description={t("equipment.noMaintenanceHint")}
          />
        ) : (
          <ul>
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-3 row-comfortable border-b border-line last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setEditing(log)}
                  className="min-w-0 flex-1 text-start"
                >
                  <p className="truncate text-sm text-ink">
                    {log.description || t(KIND_KEY[log.kind] as never)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{formatDate(log.performed_on, locale)}</span>
                    <Badge>{t(KIND_KEY[log.kind] as never)}</Badge>
                    {log.transaction_id && (
                      <Badge tone="accent">{t("equipment.loggedInFinance")}</Badge>
                    )}
                  </p>
                </button>

                {log.cost_minor != null && (
                  <span className="tnum shrink-0 text-sm text-danger">
                    −{formatMinor(log.cost_minor)}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmDelete(log)}
                  aria-label={t("common.delete")}
                  className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {(composing || editing) && (
        <MaintenanceForm
          machine={machine}
          existing={editing ?? undefined}
          onClose={() => {
            setComposing(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("equipment.deleteMaintenance")}
        // Says out loud that the Finance expense goes too — otherwise deleting
        // a typo would quietly change last month's spend.
        body={t("equipment.deleteMaintenanceBody")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </div>
  );
}

function Stat({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-0.5 text-2xs text-faint">{hint}</p>}
    </div>
  );
}
