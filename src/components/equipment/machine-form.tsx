"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComboCreate } from "@/components/ui/combo-create";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import { MoneyInput } from "@/components/ui/number-input";
import { createMachine, deleteMachine, updateMachine } from "@/lib/actions/equipment";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { STATUS_KEY } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Machine, MachineStatus, Vocabulary } from "@/lib/types";
import { MACHINE_STATUSES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { vocabOptions } from "@/lib/vocab";

export function MachineForm({
  existing,
  kinds = [],
}: {
  existing?: Machine;
  /** The `machine_kind` vocabulary, for the Type picker. */
  kinds?: Vocabulary[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const kindId = useId();
  const modelId = useId();
  const serialId = useId();
  const statusId = useId();
  const locationId = useId();
  const boughtId = useId();
  const priceId = useId();
  const serviceId = useId();
  const notesId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<string | null>(existing?.kind ?? null);
  const [model, setModel] = useState(existing?.model ?? "");
  const [serial, setSerial] = useState(existing?.serial ?? "");
  const [status, setStatus] = useState<MachineStatus>(
    existing?.status ?? "operational"
  );
  const [location, setLocation] = useState(existing?.location ?? "");
  const [purchasedOn, setPurchasedOn] = useState<string | null>(
    existing?.purchased_on ?? null
  );
  const [price, setPrice] = useState<number | null>(
    existing?.purchase_price_minor == null
      ? null
      : toMajor(existing.purchase_price_minor)
  );
  const [nextServiceOn, setNextServiceOn] = useState<string | null>(
    existing?.next_service_on ?? null
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  // Pre-ticked only if this machine ALREADY has a linked purchase expense —
  // otherwise off, because most machines were bought (and expensed) before
  // they were entered here.
  const [logPurchase, setLogPurchase] = useState(
    !!existing?.purchase_transaction_id
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [kindRows, setKindRows] = useState(kinds);
  const kindOptions = vocabOptions(
    kindRows,
    "machine_kind",
    existing?.kind ? [existing.kind] : []
  ).map((v) => ({ value: v.label, label: v.label }));

  const emptyFields = name.trim() ? [] : [t("equipment.machineName")];

  const submit = async () => {
    const input = {
      name,
      kind: kind || null,
      model: model || null,
      serial: serial || null,
      status,
      location: location || null,
      purchasedOn,
      purchasePrice: price,
      logPurchaseExpense: logPurchase,
      nextServiceOn,
      notes: notes || null,
      links,
    };

    const result = await run<unknown>(
      () =>
        existing
          ? updateMachine(existing.id, input)
          : createMachine(input).then((r) =>
              r.ok ? { ok: true as const, data: r.data.id } : r
            ),
      {
        successMessage: t("equipment.saved"),
        errorMessage: t("equipment.saveFailed"),
      }
    );

    if (result.ok) {
      router.push(
        existing
          ? `/equipment/machines/${existing.id}`
          : `/equipment/machines/${result.data as string}`
      );
      router.refresh();
    }
  };

  const remove = async () => {
    const result = await run(() => deleteMachine(existing!.id), {
      successMessage: t("equipment.deleted"),
      errorMessage: t("equipment.saveFailed"),
    });
    if (result.ok) {
      router.push("/equipment");
      router.refresh();
    }
  };

  return (
    <>
      <CreateForm
        onSubmit={submit}
        emptyFields={emptyFields}
        pending={pending}
        submitLabel={existing ? t("common.save") : t("common.create")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={nameId} label={t("equipment.machineName")}>
            <TextInput
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("equipment.machineNamePlaceholder")}
              autoFocus
            />
          </Field>
          <Field id={kindId} label={t("equipment.machineKind")} optional={t("common.optional")}>
            <ComboCreate
              id={kindId}
              value={kind}
              onChange={setKind}
              options={kindOptions}
              label={t("equipment.machineKind")}
              placeholder={t("equipment.machineKindPlaceholder")}
              onCreate={async (label) => {
                const result = await createVocabulary({ kind: "machine_kind", label });
                if (!result.ok) return null;
                setKindRows((rows) => [
                  ...rows.filter((r) => r.id !== result.data.id),
                  result.data,
                ]);
                return result.data.label;
              }}
            />
          </Field>
        </div>

        <Field id={statusId} label={t("equipment.status")} hint={t("equipment.statusHint")}>
          <Dropdown
            id={statusId}
            value={status}
            onChange={(v) => setStatus(v as MachineStatus)}
            options={MACHINE_STATUSES.map((value) => ({
              value,
              label: t(STATUS_KEY[value] as never),
            }))}
            label={t("equipment.status")}
            placeholder={t("equipment.operational")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={modelId} label={t("equipment.model")} optional={t("common.optional")}>
            <TextInput
              id={modelId}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </Field>
          <Field id={serialId} label={t("equipment.serial")} optional={t("common.optional")}>
            <TextInput
              id={serialId}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={locationId} label={t("equipment.location")} optional={t("common.optional")}>
            <TextInput
              id={locationId}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field id={boughtId} label={t("equipment.purchasedOn")} optional={t("common.optional")}>
            <DatePicker id={boughtId} value={purchasedOn} onChange={setPurchasedOn} />
          </Field>
          <Field id={priceId} label={t("equipment.purchasePrice")} optional={t("common.optional")}>
            <MoneyInput id={priceId} value={price} onChange={setPrice} min={0} />
          </Field>
        </div>

        {/* When set, a reminder is auto-created as the date approaches (0017). */}
        <Field
          id={serviceId}
          label={t("equipment.nextServiceOn")}
          hint={t("equipment.nextServiceHint")}
          optional={t("common.optional")}
        >
          <DatePicker
            id={serviceId}
            value={nextServiceOn}
            onChange={setNextServiceOn}
            className="w-full sm:w-56"
          />
        </Field>

        {/* Only offered once there's a price to log. Off by default: a machine
            you bought last year was already expensed then, and logging it now
            would double-count AND charge the wrong month. */}
        {price != null && price > 0 && (
          <Checkbox
            checked={logPurchase}
            onChange={(e) => setLogPurchase(e.target.checked)}
            label={t("equipment.logPurchase")}
            description={t("equipment.logPurchaseHint")}
          />
        )}

        <Field id={notesId} label={t("common.notes")} optional={t("common.optional")}>
          <TextArea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </Field>

        <LinksEditor value={links} onChange={setLinks} />
      </CreateForm>

      {existing && (
        <div className="mt-6 border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            icon={<Trash2 aria-hidden className="size-4" />}
            className="text-danger hover:text-danger"
          >
            {t("common.delete")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t("equipment.deleteMachine")}
        // ⚠️ Says plainly that the EXPENSES survive. Deleting a machine must
        // not quietly rewrite what the shop spent last year.
        body={t("equipment.deleteMachineBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
