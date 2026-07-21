"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { createSupply, updateSupply } from "@/lib/actions/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Supply } from "@/lib/types";
import { SUPPLY_UNITS } from "@/lib/types";
import { useAction } from "@/lib/use-action";

export function SupplyForm({ existing }: { existing?: Supply }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const unitId = useId();
  const qtyId = useId();
  const lowId = useId();
  const notesId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "pcs");
  const [quantity, setQuantity] = useState<number | null>(
    existing ? Number(existing.quantity) : null
  );
  const [lowThreshold, setLowThreshold] = useState<number | null>(
    existing?.low_threshold == null ? null : Number(existing.low_threshold)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const emptyFields = name.trim() ? [] : [t("equipment.supplyName")];

  const submit = async () => {
    const input = {
      name,
      unit,
      quantity,
      lowThreshold,
      notes: notes || null,
    };

    const result = await run<unknown>(
      () =>
        existing
          ? updateSupply(existing.id, input)
          : createSupply(input).then((r) =>
              r.ok ? { ok: true as const, data: undefined } : r
            ),
      {
        successMessage: t("equipment.saved"),
        errorMessage: t("equipment.saveFailed"),
      }
    );

    if (result.ok) {
      router.push("/equipment?tab=supplies");
      router.refresh();
    }
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={existing ? t("common.save") : t("common.create")}
    >
      <Field id={nameId} label={t("equipment.supplyName")}>
        <TextInput
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("equipment.supplyNamePlaceholder")}
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={unitId} label={t("equipment.unit")}>
          <Dropdown
            id={unitId}
            value={unit}
            onChange={setUnit}
            options={SUPPLY_UNITS.map((u) => ({ value: u, label: u }))}
            label={t("equipment.unit")}
            placeholder="pcs"
          />
        </Field>
        <Field id={qtyId} label={t("equipment.quantity")}>
          <NumberInput id={qtyId} value={quantity} onChange={setQuantity} min={0} />
        </Field>
        <Field
          id={lowId}
          label={t("equipment.lowThreshold")}
          optional={t("common.optional")}
          // Null means "never warn", which is right for things bought on
          // demand. Said out loud so an empty field doesn't look like a bug.
          hint={t("equipment.lowThresholdHint")}
        >
          <NumberInput
            id={lowId}
            value={lowThreshold}
            onChange={setLowThreshold}
            min={0}
          />
        </Field>
      </div>

      <Field id={notesId} label={t("creative.ideaBody")} optional={t("common.optional")}>
        <TextArea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </Field>
    </CreateForm>
  );
}
