"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { KIND_KEY } from "@/components/equipment/maintenance-panel";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { createMaintenance, updateMaintenance } from "@/lib/actions/equipment";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Machine, MaintenanceKind, MaintenanceLog } from "@/lib/types";
import { MAINTENANCE_KINDS } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Logging maintenance.
 *
 * ⚠️ THE COST FIELD IS THE FINANCE LINK. Any amount entered here creates (or
 * updates) a real transaction tagged back to this machine — there is no
 * "also log as expense" checkbox, deliberately: an unchecked box is a repair
 * that silently never reaches Finance, which is the exact problem
 * `transactions.source_type` exists to solve. The hint under the field says so
 * plainly, because invisible side effects are their own kind of bug.
 */
export function MaintenanceForm({
  machine,
  existing,
  onClose,
}: {
  machine: Machine;
  existing?: MaintenanceLog;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const dateId = useId();
  const kindId = useId();
  const whatId = useId();
  const costId = useId();

  const [performedOn, setPerformedOn] = useState(
    existing?.performed_on ?? todayInIstanbul()
  );
  const [kind, setKind] = useState<MaintenanceKind>(existing?.kind ?? "repair");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [cost, setCost] = useState<number | null>(
    existing?.cost_minor == null ? null : toMajor(existing.cost_minor)
  );

  const emptyFields = description.trim() ? [] : [t("equipment.what")];

  const submit = async () => {
    const input = {
      machineId: machine.id,
      performedOn,
      kind,
      description,
      cost,
    };

    const result = await run<unknown>(
      () =>
        existing
          ? updateMaintenance(existing.id, input)
          : createMaintenance(input).then((r) =>
              r.ok ? { ok: true as const, data: undefined } : r
            ),
      {
        successMessage: t("equipment.saved"),
        errorMessage: t("equipment.saveFailed"),
      }
    );

    if (result.ok) {
      onClose();
      router.refresh();
    }
  };

  return (
    <CreateOverlay
      open
      title={existing ? t("equipment.editMaintenance") : t("equipment.logMaintenance")}
      description={machine.name}
      onClose={onClose}
    >
      <CreateForm
        onSubmit={submit}
        emptyFields={emptyFields}
        pending={pending}
        onCancel={onClose}
        submitLabel={existing ? t("common.save") : t("common.create")}
      >
        <Field id={whatId} label={t("equipment.what")}>
          <TextInput
            id={whatId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("equipment.whatPlaceholder")}
            autoFocus
            maxLength={200}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={dateId} label={t("equipment.performedOn")}>
            <DatePicker
              id={dateId}
              value={performedOn}
              onChange={(v) => setPerformedOn(v ?? todayInIstanbul())}
              clearable={false}
            />
          </Field>
          <Field id={kindId} label={t("equipment.maintenanceKind")}>
            <Dropdown
              id={kindId}
              value={kind}
              onChange={(v) => setKind(v as MaintenanceKind)}
              options={MAINTENANCE_KINDS.map((value) => ({
                value,
                label: t(KIND_KEY[value] as never),
              }))}
              label={t("equipment.maintenanceKind")}
              placeholder={t("equipment.repair")}
            />
          </Field>
        </div>

        <Field
          id={costId}
          label={t("equipment.cost")}
          optional={t("common.optional")}
          // The hint is load-bearing: it tells you the money lands in Finance.
          hint={t("equipment.costHint")}
        >
          <MoneyInput id={costId} value={cost} onChange={setCost} min={0} />
        </Field>
      </CreateForm>
    </CreateOverlay>
  );
}
