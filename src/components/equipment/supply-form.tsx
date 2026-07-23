"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ComboCreate } from "@/components/ui/combo-create";
import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { createSupply, updateSupply } from "@/lib/actions/equipment";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { isPrintingCategory } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Supply, Vocabulary } from "@/lib/types";
import { SUPPLY_UNITS } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { vocabOptions } from "@/lib/vocab";

export function SupplyForm({
  existing,
  categories = [],
  items = [],
}: {
  existing?: Supply;
  /** Finance expense category names, for the Category picker. */
  categories?: string[];
  /** The `supply_item` vocabulary, for the Item picker. */
  items?: Vocabulary[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const categoryId = useId();
  const itemId = useId();
  const unitId = useId();
  const qtyId = useId();
  const lowId = useId();
  const costId = useId();
  const notesId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<string | null>(existing?.category ?? null);
  const [item, setItem] = useState<string | null>(existing?.item ?? null);
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
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);

  // ⚠️ THE PRINTING SIGNAL IS THE CATEGORY. Filament/Resin → weighed in grams,
  // costed per kg, deducted per print. Any other category → counted, no cost.
  // No toggle: the category the user already picks is the whole answer.
  const isPrinting = isPrintingCategory(category);

  // A printing material is tracked in KILOGRAMS — you buy filament by the kg,
  // and the cost is per kg, so stock and warning are in kg too (decimals are
  // fine: 0.3 kg, 0.085 kg). The unit is forced to `kg` while it's a printing
  // material; a print's gram usage is converted to kg when it deducts stock.
  const effectiveUnit = isPrinting ? "kg" : unit;

  const categoryOptions = categories.map((c) => ({ value: c, label: c }));
  const [itemRows, setItemRows] = useState(items);
  const itemOptions = vocabOptions(
    itemRows,
    "supply_item",
    existing?.item ? [existing.item] : []
  ).map((v) => ({ value: v.label, label: v.label }));

  const emptyFields = name.trim() ? [] : [t("equipment.supplyName")];

  const submit = async () => {
    const input = {
      name,
      category,
      item,
      unit: effectiveUnit,
      quantity,
      lowThreshold,
      // Only a printing material carries a per-kg cost.
      costPerKg: isPrinting ? costPerKg : null,
      notes: notes || null,
      links,
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
      router.push(
        existing ? `/equipment/supplies/${existing.id}` : "/equipment?tab=supplies"
      );
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={categoryId}
          label={t("equipment.supplyCategory")}
          optional={t("common.optional")}
          // A restock books its expense under this Finance category.
          hint={t("equipment.supplyCategoryHint")}
        >
          <ComboCreate
            id={categoryId}
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            label={t("equipment.supplyCategory")}
            placeholder={t("equipment.supplyCategoryPlaceholder")}
            // Typing a new category creates it as a Finance expense category on
            // save (see createSupply) — nothing to persist here, just adopt it.
            onCreate={async (label) => label}
          />
        </Field>
        <Field id={itemId} label={t("equipment.supplyItem")} optional={t("common.optional")}>
          <ComboCreate
            id={itemId}
            value={item}
            onChange={setItem}
            options={itemOptions}
            label={t("equipment.supplyItem")}
            placeholder={t("equipment.supplyItemPlaceholder")}
            onCreate={async (label) => {
              const result = await createVocabulary({ kind: "supply_item", label });
              if (!result.ok) return null;
              setItemRows((rows) => [
                ...rows.filter((r) => r.id !== result.data.id),
                result.data,
              ]);
              return result.data.label;
            }}
          />
        </Field>
      </div>

      {/* Printing materials carry a per-kg cost that feeds print costing. Shown
          only when the category is one — the category IS the signal. */}
      {isPrinting && (
        <Field
          id={costId}
          label={t("equipment.costPerKg")}
          optional={t("common.optional")}
          hint={t("equipment.costPerKgHint")}
        >
          <MoneyInput id={costId} value={costPerKg} onChange={setCostPerKg} min={0} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={unitId}
          label={t("equipment.unit")}
          hint={isPrinting ? t("equipment.unitKgLocked") : undefined}
        >
          {isPrinting ? (
            <TextInput id={unitId} value="kg" disabled readOnly />
          ) : (
            <Dropdown
              id={unitId}
              value={unit}
              onChange={setUnit}
              options={SUPPLY_UNITS.map((u) => ({ value: u, label: u }))}
              label={t("equipment.unit")}
              placeholder="pcs"
            />
          )}
        </Field>
        <Field id={qtyId} label={t("equipment.quantity")}>
          <NumberInput
            id={qtyId}
            value={quantity}
            onChange={setQuantity}
            min={0}
            suffix={effectiveUnit}
          />
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
            suffix={effectiveUnit}
          />
        </Field>
      </div>

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
  );
}
