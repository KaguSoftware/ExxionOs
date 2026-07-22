"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ComboCreate } from "@/components/ui/combo-create";
import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { createSupply, updateSupply } from "@/lib/actions/equipment";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Supply, Vocabulary } from "@/lib/types";
import { SUPPLY_UNITS } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { vocabOptions } from "@/lib/vocab";

export function SupplyForm({
  existing,
  supplyTypes = [],
}: {
  existing?: Supply;
  supplyTypes?: Vocabulary[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const typeId = useId();
  const unitId = useId();
  const qtyId = useId();
  const lowId = useId();
  const costId = useId();
  const notesId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<string | null>(existing?.type ?? null);
  // A supply is a printing material iff it carries a per-kg cost — that is the
  // one signal, so the toggle just mirrors whether cost_per_kg_minor is set.
  const [isPrinting, setIsPrinting] = useState(
    existing ? existing.cost_per_kg_minor != null : false
  );
  const [unit, setUnit] = useState(existing?.unit ?? "pcs");
  const [costPerKg, setCostPerKg] = useState<number | null>(
    existing?.cost_per_kg_minor == null ? null : toMajor(existing.cost_per_kg_minor)
  );
  const [quantity, setQuantity] = useState<number | null>(
    existing ? Number(existing.quantity) : null
  );
  const [lowThreshold, setLowThreshold] = useState<number | null>(
    existing?.low_threshold == null ? null : Number(existing.low_threshold)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // Live words of this kind, plus the supply's own type even if archived since —
  // so opening and saving an old supply can't silently blank its category.
  const [types, setTypes] = useState(supplyTypes);
  const typeOptions = vocabOptions(
    types,
    "supply_type",
    existing?.type ? [existing.type] : []
  ).map((v) => ({ value: v.label, label: v.label }));

  const emptyFields = name.trim() ? [] : [t("equipment.supplyName")];

  // Turning the printing toggle on nudges the unit to kg (filament is weighed);
  // turning it off clears the cost, since packaging has no per-kg price.
  const togglePrinting = (next: boolean) => {
    setIsPrinting(next);
    if (next) {
      if (unit === "pcs") setUnit("kg");
    } else {
      setCostPerKg(null);
    }
  };

  const submit = async () => {
    const input = {
      name,
      type,
      unit,
      quantity,
      lowThreshold,
      costPerKg: isPrinting ? costPerKg : null,
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={nameId} label={t("equipment.supplyName")}>
          <TextInput
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("equipment.supplyNamePlaceholder")}
            autoFocus
          />
        </Field>
        <Field id={typeId} label={t("equipment.supplyType")} optional={t("common.optional")}>
          <ComboCreate
            id={typeId}
            value={type}
            onChange={setType}
            options={typeOptions}
            label={t("equipment.supplyType")}
            placeholder={t("equipment.supplyTypePlaceholder")}
            onCreate={async (label) => {
              const result = await createVocabulary({ kind: "supply_type", label });
              if (!result.ok) return null;
              // Adopt the row the server returned — it may be an existing word in
              // a different spelling, and the list must show that spelling.
              setTypes((rows) => [
                ...rows.filter((r) => r.id !== result.data.id),
                result.data,
              ]);
              return result.data.label;
            }}
          />
        </Field>
      </div>

      {/* The one signal that splits filament from packaging — and the cost
          field it reveals, grouped with it so the dependency reads. */}
      <div className="rounded-xl border border-line p-4">
        <Checkbox
          checked={isPrinting}
          onChange={(e) => togglePrinting(e.target.checked)}
          label={t("equipment.isPrintingMaterial")}
          description={t("equipment.isPrintingMaterialHint")}
        />
        {isPrinting && (
          <Field
            id={costId}
            label={t("equipment.costPerKg")}
            optional={t("common.optional")}
            hint={t("equipment.costPerKgHint")}
            className="mt-4 border-t border-line pt-4"
          >
            <MoneyInput id={costId} value={costPerKg} onChange={setCostPerKg} min={0} />
          </Field>
        )}
      </div>

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
