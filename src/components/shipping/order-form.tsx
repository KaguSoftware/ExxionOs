"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { createOrder, updateOrder, type OrderLineInput } from "@/lib/actions/shipping";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Client, Order, OrderLine } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatMinor } from "@/lib/utils";

/** A product the line can be linked to, with its collection for context. */
export type ProductOption = {
  id: string;
  name: string;
  collectionName: string;
  priceMinor: number | null;
};

type DraftLine = OrderLineInput & { key: string };

let keySeq = 0;
const nextKey = () => `line-${keySeq++}`;

export function OrderForm({
  order,
  lines: existingLines,
  clients,
  products,
}: {
  order?: Order;
  lines?: OrderLine[];
  clients: Client[];
  products: ProductOption[];
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  const [code, setCode] = useState(order?.code ?? "");
  const [title, setTitle] = useState(order?.title ?? "");
  const [clientId, setClientId] = useState<string>(order?.client_id ?? "");
  const [promisedOn, setPromisedOn] = useState<string | null>(
    order?.promised_on ?? null
  );
  const [carrier, setCarrier] = useState(order?.carrier ?? "");
  const [tracking, setTracking] = useState(order?.tracking_number ?? "");
  const [shippingCost, setShippingCost] = useState<number | null>(
    order?.shipping_cost_minor != null ? toMajor(order.shipping_cost_minor) : null
  );
  const [notes, setNotes] = useState(order?.notes ?? "");

  const [lines, setLines] = useState<DraftLine[]>(() =>
    (existingLines ?? []).map((l) => ({
      key: nextKey(),
      productId: l.product_id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: toMajor(l.unit_price_minor),
    }))
  );

  /**
   * ⚠️ The total is DERIVED, never typed. Two fields holding the same number
   * disagree the moment one is edited, and the one people trust is the one
   * that isn't itemised.
   */
  const totalMinor = lines.reduce(
    (sum, line) =>
      sum +
      Math.max(1, Math.round(line.quantity || 1)) *
        Math.round((line.unitPrice ?? 0) * 100),
    0
  );

  const addLine = () =>
    setLines((list) => [
      ...list,
      { key: nextKey(), productId: null, description: "", quantity: 1, unitPrice: null },
    ]);

  const patchLine = (key: string, patch: Partial<OrderLineInput>) =>
    setLines((list) =>
      list.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );

  const removeLine = (key: string) =>
    setLines((list) => list.filter((line) => line.key !== key));

  /** Picking a product fills the description and price — both still editable. */
  const pickProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    patchLine(key, {
      productId: productId || null,
      ...(product
        ? {
            description: product.name,
            unitPrice:
              product.priceMinor != null ? toMajor(product.priceMinor) : null,
          }
        : {}),
    });
  };

  const emptyFields = [
    ...(title.trim() ? [] : [t("shipping.orderTitle")]),
    ...(lines.some((l) => l.description.trim() || l.productId)
      ? []
      : [t("shipping.lines")]),
  ];

  const submit = async () => {
    const payload = {
      code: code.trim() || null,
      clientId: clientId || null,
      title,
      notes: notes.trim() || null,
      promisedOn,
      carrier: carrier.trim() || null,
      trackingNumber: tracking.trim() || null,
      shippingCost,
      // The `key` is a client-side identity for React only — never sent.
      lines: lines.map((line) => ({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    };

    const result = await run<unknown>(
      () =>
        (order
          ? updateOrder(order.id, payload)
          : createOrder(payload)
        ).then((r) => (r.ok ? { ok: true as const, data: undefined } : r)),
      {
        successMessage: t("shipping.saved"),
        errorMessage: t("shipping.saveFailed"),
      }
    );

    if (result.ok) {
      router.push(order ? `/shipping/orders/${order.id}` : "/shipping");
      router.refresh();
    }
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={order ? t("common.save") : t("shipping.newOrder")}
    >
      <div className="flex flex-col gap-4">
        <Field id={`${ids}-title`} label={t("shipping.orderTitle")}>
          <TextInput
            id={`${ids}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("shipping.orderTitlePlaceholder")}
            autoFocus
          />
        </Field>

        <div className="flex flex-wrap gap-4">
          <Field
            id={`${ids}-code`}
            label={t("shipping.code")}
            optional={t("common.optional")}
            hint={t("shipping.codeHint")}
            className="min-w-40 flex-1"
          >
            <TextInput
              id={`${ids}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EX-014"
            />
          </Field>

          <Field
            id={`${ids}-client`}
            label={t("shipping.client")}
            optional={t("common.optional")}
            className="min-w-48 flex-1"
          >
            <Dropdown
              id={`${ids}-client`}
              value={clientId}
              onChange={setClientId}
              options={[
                { value: "", label: t("shipping.noClient") },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
              label={t("shipping.client")}
              placeholder={t("shipping.noClient")}
            />
          </Field>
        </div>

        {/* --- line items --------------------------------------------------- */}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">
              {t("shipping.lines")}
            </span>
            <Button
              size="sm"
              onClick={addLine}
              icon={<Plus aria-hidden className="size-3.5" />}
            >
              {t("shipping.addLine")}
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-faint">
              {t("shipping.noLinesHint")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((line) => (
                /**
                 * ⚠️ A GRID, NOT `flex-wrap`. Five controls needed ~612px of
                 * minimum width inside a 704px column, so the row only just
                 * fitted on a desktop and collapsed into a scramble below it —
                 * the `w-20` quantity box being the first casualty. That was
                 * reported as "items, number of items UI squished".
                 *
                 * Two explicit shapes instead of letting wrapping decide:
                 * stacked and labelled on narrow screens, one line on wide
                 * ones. Quantity and price sit side by side at every width
                 * because they are read together.
                 */
                <li
                  key={line.key}
                  className="rounded-lg border border-line p-3"
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
                    {products.length > 0 && (
                      <LineField
                        label={t("shipping.linkedProduct")}
                        className="col-span-2 sm:col-span-1"
                      >
                        <Dropdown
                          value={line.productId ?? ""}
                          onChange={(v) => pickProduct(line.key, v)}
                          options={[
                            { value: "", label: t("shipping.noProduct") },
                            ...products.map((p) => ({
                              value: p.id,
                              label: p.name,
                              hint: p.collectionName,
                            })),
                          ]}
                          label={t("shipping.linkedProduct")}
                          placeholder={t("shipping.noProduct")}
                        />
                      </LineField>
                    )}

                    <LineField
                      label={t("shipping.quantity")}
                      className="sm:w-24"
                    >
                      <NumberInput
                        value={line.quantity}
                        onChange={(v) => patchLine(line.key, { quantity: v ?? 1 })}
                        min={1}
                        aria-label={t("shipping.quantity")}
                      />
                    </LineField>

                    <LineField
                      label={t("shipping.unitPrice")}
                      className="sm:w-36"
                    >
                      <MoneyInput
                        value={line.unitPrice}
                        onChange={(v) => patchLine(line.key, { unitPrice: v })}
                        min={0}
                        aria-label={t("shipping.unitPrice")}
                      />
                    </LineField>

                    {/* Aligned to the control row, not the label row, so it
                        sits on the inputs' baseline rather than floating. */}
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      aria-label={t("common.delete")}
                      className="col-start-2 row-start-1 h-9 w-9 justify-self-end rounded-md p-2 text-faint transition-colors hover:bg-raised hover:text-danger sm:col-start-auto sm:row-start-auto"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>

                    <LineField
                      label={t("shipping.lineDescription")}
                      className="col-span-2 sm:col-span-4"
                    >
                      <TextInput
                        value={line.description}
                        onChange={(e) =>
                          patchLine(line.key, { description: e.target.value })
                        }
                        placeholder={t("shipping.lineDescriptionPlaceholder")}
                        aria-label={t("shipping.lineDescription")}
                      />
                    </LineField>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">{t("shipping.total")}</span>
            <span className="tnum text-base font-semibold text-ink">
              {formatMinor(totalMinor)}
            </span>
          </div>
          <p className="mt-1 text-2xs text-faint">{t("shipping.totalHint")}</p>
        </div>

        {/* --- delivery ------------------------------------------------------ */}
        <div className="flex flex-wrap gap-4 border-t border-line pt-4">
          <Field
            id={`${ids}-promised`}
            label={t("shipping.promisedOn")}
            optional={t("common.optional")}
            className="min-w-44 flex-1"
          >
            <DatePicker
              id={`${ids}-promised`}
              value={promisedOn}
              onChange={setPromisedOn}
              placeholder={t("common.chooseDate")}
            />
          </Field>

          <Field
            id={`${ids}-carrier`}
            label={t("shipping.carrier")}
            optional={t("common.optional")}
            className="min-w-40 flex-1"
          >
            <TextInput
              id={`${ids}-carrier`}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Yurtiçi Kargo"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <Field
            id={`${ids}-tracking`}
            label={t("shipping.trackingNumber")}
            optional={t("common.optional")}
            className="min-w-44 flex-1"
          >
            <TextInput
              id={`${ids}-tracking`}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </Field>

          <Field
            id={`${ids}-shipcost`}
            label={t("shipping.shippingCost")}
            optional={t("common.optional")}
            className="min-w-40 flex-1"
          >
            <MoneyInput
              id={`${ids}-shipcost`}
              value={shippingCost}
              onChange={setShippingCost}
              min={0}
            />
          </Field>
        </div>

        <Field
          id={`${ids}-notes`}
          label={t("shipping.notes")}
          optional={t("common.optional")}
        >
          <TextArea
            id={`${ids}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </CreateForm>
  );
}

/**
 * A label above a control inside a line-item row.
 *
 * Deliberately NOT `ui/field.tsx`: that one owns an id, hint and error slot
 * and is built for a form column. A line item repeats the same four controls
 * on every row, so the labels are visual column headers — the controls carry
 * their own `aria-label`, and repeating `htmlFor` ids across rows is exactly
 * the bug `field.tsx` warns about.
 */
function LineField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span aria-hidden className="text-2xs font-medium text-faint">
        {label}
      </span>
      {children}
    </div>
  );
}
