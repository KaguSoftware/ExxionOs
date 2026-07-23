"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ImageStrip } from "@/components/creative/image-strip";
import { Button } from "@/components/ui/button";
import { ComboCreate } from "@/components/ui/combo-create";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { createProduct, deleteProduct, updateProduct } from "@/lib/actions/creative";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { productCost, productMargin } from "@/lib/costing";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Product, StoredImage, Supply, Vocabulary } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatMinor } from "@/lib/utils";
import { vocabOptions } from "@/lib/vocab";

export function ProductForm({
  collectionId,
  supplies,
  machineRateMinor,
  existing,
  images = [],
  productTypes = [],
}: {
  collectionId: string;
  supplies: Supply[];
  machineRateMinor: number;
  existing?: Product;
  images?: StoredImage[];
  productTypes?: Vocabulary[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const kindId = useId();
  const supplyFieldId = useId();
  const gramsId = useId();
  const measuredId = useId();
  const hoursId = useId();
  const priceId = useId();
  const notesId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<string | null>(existing?.kind ?? null);

  // Words this product may show: the live vocabulary, plus its OWN type even
  // if that word was archived since — otherwise opening and saving an old
  // product would quietly erase its type.
  const [types, setTypes] = useState(productTypes);
  const typeOptions = vocabOptions(
    types,
    "product_type",
    existing?.kind ? [existing.kind] : []
  ).map((v) => ({ value: v.label, label: v.label }));
  const [supplyId, setSupplyId] = useState<string | null>(existing?.supply_id ?? null);
  const [grams, setGrams] = useState<number | null>(toNumber(existing?.grams));
  const [measuredGrams, setMeasuredGrams] = useState<number | null>(
    toNumber(existing?.measured_grams)
  );
  const [hours, setHours] = useState<number | null>(toNumber(existing?.print_hours));
  const [price, setPrice] = useState<number | null>(
    existing?.price_minor == null ? null : toMajor(existing.price_minor)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Live cost preview using the SAME function the list uses — so what you see
  // while typing is exactly what the card will show.
  const preview = productCost(
    { grams, measured_grams: measuredGrams, print_hours: hours, supply_id: supplyId },
    supplies,
    machineRateMinor
  );
  const previewMargin = productMargin(
    { price_minor: price == null ? null : Math.round(price * 100) },
    preview
  );

  // Only printing materials (a per-kg cost) belong in this dropdown, plus the
  // product's own supply even if it was archived since — so opening and saving
  // an old product can't silently unlink it.
  const active = supplies.filter(
    (s) =>
      (!s.archived_at && s.cost_per_kg_minor != null) ||
      s.id === existing?.supply_id
  );

  const emptyFields = name.trim() ? [] : [t("creative.productName")];

  const submit = async () => {
    const input = {
      collectionId,
      name,
      kind: kind?.trim() || null,
      supplyId,
      grams,
      measuredGrams,
      printHours: hours,
      price,
      notes: notes || null,
      links,
    };

    const result = await run<unknown>(
      () =>
        existing
          ? updateProduct(existing.id, input)
          : createProduct(input).then((r) =>
              r.ok ? { ok: true as const, data: undefined } : r
            ),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );

    if (result.ok) {
      router.push(`/creative/collections/${collectionId}`);
      router.refresh();
    }
  };

  const remove = async () => {
    const result = await run(() => deleteProduct(existing!.id, collectionId), {
      successMessage: t("creative.deleted"),
      errorMessage: t("creative.saveFailed"),
    });
    if (result.ok) {
      router.push(`/creative/collections/${collectionId}`);
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
          <Field id={nameId} label={t("creative.productName")}>
            <TextInput
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("creative.productNamePlaceholder")}
              autoFocus
            />
          </Field>
          <Field id={kindId} label={t("creative.productKind")} optional={t("common.optional")}>
            <ComboCreate
              id={kindId}
              value={kind}
              onChange={setKind}
              options={typeOptions}
              label={t("creative.productKind")}
              placeholder={t("creative.productKindPlaceholder")}
              onCreate={async (label) => {
                const result = await createVocabulary({
                  kind: "product_type",
                  label,
                });
                if (!result.ok) return null;
                // Adopt the row the server returned — it may be an existing
                // word in a different spelling, and the list must show that
                // spelling rather than what was typed.
                setTypes((rows) => [
                  ...rows.filter((r) => r.id !== result.data.id),
                  result.data,
                ]);
                return result.data.label;
              }}
            />
          </Field>
        </div>

        <Field id={supplyFieldId} label={t("creative.material")} optional={t("common.optional")}>
          <Dropdown
            id={supplyFieldId}
            value={supplyId}
            onChange={(v) => setSupplyId(v || null)}
            options={active.map((s) => ({
              value: s.id,
              label: s.name,
              hint:
                s.cost_per_kg_minor == null
                  ? undefined
                  : formatMinor(s.cost_per_kg_minor) + "/kg",
            }))}
            label={t("creative.material")}
            placeholder={t("common.choose")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={gramsId} label={t("creative.grams")} optional={t("common.optional")}>
            <NumberInput id={gramsId} value={grams} onChange={setGrams} min={0} step={1} />
          </Field>
          <Field id={hoursId} label={t("creative.printHours")} optional={t("common.optional")}>
            <NumberInput
              id={hoursId}
              value={hours}
              onChange={setHours}
              min={0}
              step={0.5}
            />
          </Field>
          <Field id={priceId} label={t("creative.price")} optional={t("common.optional")}>
            <MoneyInput id={priceId} value={price} onChange={setPrice} min={0} />
          </Field>
        </div>

        {/* The MEASURED weight — the truth once a unit has been weighed
            (supports included). Usually captured on the first print run, but
            editable here so a re-weigh or correction has a home. When set it
            overrides the estimate for stock deduction AND cost everywhere. */}
        <Field
          id={measuredId}
          label={t("creative.measuredGrams")}
          hint={t("creative.measuredGramsHint")}
          optional={t("common.optional")}
        >
          <NumberInput
            id={measuredId}
            value={measuredGrams}
            onChange={setMeasuredGrams}
            min={0}
            step={1}
          />
        </Field>

        {/* Live cost, computed from the same helper the cards use. */}
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted">{t("creative.unitCost")}</span>
            {preview == null ? (
              <span className="text-xs text-faint">{t("creative.costUnknown")}</span>
            ) : (
              <span className="tnum text-sm font-medium text-ink">
                {formatMinor(preview.totalMinor)}
              </span>
            )}
          </div>
          {preview == null ? (
            <p className="mt-1 text-2xs text-faint">{t("creative.costUnknownHint")}</p>
          ) : (
            <p className="mt-1 text-2xs text-faint">
              {t("creative.costBreakdown", {
                material: formatMinor(preview.materialMinor),
                machine: formatMinor(preview.machineMinor),
              })}
            </p>
          )}
          {previewMargin != null && (
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <span className="text-xs text-muted">{t("creative.margin")}</span>
              <span
                className={cn(
                  "tnum text-sm font-medium",
                  previewMargin >= 0 ? "text-success" : "text-danger"
                )}
              >
                {previewMargin >= 0 ? "+" : "−"}
                {formatMinor(Math.abs(previewMargin))}
              </span>
            </div>
          )}
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

        {/* Photos need a real row to attach to, so they only appear on edit —
            a staged-upload path would be a lot of machinery for one field. */}
        {existing && (
          <ImageStrip parent="product" parentId={existing.id} images={images} />
        )}
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
        title={t("creative.deleteProduct")}
        body={t("common.deleteWarning")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}

/** `numeric` arrives from PostgREST as a string. */
function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
