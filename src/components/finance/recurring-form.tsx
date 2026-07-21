"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextInput } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { createRecurring, updateRecurring } from "@/lib/actions/finance";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Cadence, Category, Direction, RecurringItem } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Authoring a recurring item happens in a full-screen `CreateOverlay`, not a
 * modal — it's an authoring surface, and modals in this app are reserved for
 * destructive confirms. The overlay avoids a navigation, so the list behind it
 * keeps its scroll position and its filters.
 */
export function RecurringForm({
  existing,
  categories,
  onClose,
}: {
  existing?: RecurringItem;
  categories: Category[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const labelId = useId();
  const amountId = useId();
  const catId = useId();
  const cadenceId = useId();
  const dayId = useId();
  const startId = useId();
  const endId = useId();

  const [label, setLabel] = useState(existing?.label ?? "");
  const [direction, setDirection] = useState<Direction>(existing?.direction ?? "out");
  const [amount, setAmount] = useState<number | null>(
    existing ? toMajor(existing.amount_minor) : null
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.category_id ?? null
  );
  const [cadence, setCadence] = useState<Cadence>(existing?.cadence ?? "monthly");
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(
    existing?.day_of_month ?? 1
  );
  const [startsOn, setStartsOn] = useState(
    existing?.starts_on ?? `${todayInIstanbul().slice(0, 7)}-01`
  );
  const [endsOn, setEndsOn] = useState<string | null>(existing?.ends_on ?? null);

  const relevant = categories.filter(
    (c) => !c.archived_at && c.kind === (direction === "in" ? "income" : "expense")
  );

  const emptyFields: string[] = [];
  if (!label.trim()) emptyFields.push(t("finance.label"));
  if (amount == null || amount === 0) emptyFields.push(t("finance.amount"));

  const submit = async () => {
    const input = {
      label,
      direction,
      amount: amount ?? 0,
      categoryId,
      cadence,
      dayOfMonth: dayOfMonth ?? 1,
      startsOn,
      endsOn,
    };

    // Widened to `unknown`: create returns the new row, update returns void,
    // and the caller uses neither — only `ok`.
    const result = await run<unknown>(
      () =>
        existing
          ? updateRecurring(existing.id, input)
          : createRecurring(input).then((r) =>
              r.ok ? { ok: true as const, data: undefined } : r
            ),
      {
        successMessage: t("finance.saved"),
        errorMessage: t("finance.saveFailed"),
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
      title={existing ? t("finance.editRecurring") : t("finance.newRecurring")}
      description={t("finance.noRecurringHint")}
      onClose={onClose}
    >
      <CreateForm
        onSubmit={submit}
        emptyFields={emptyFields}
        pending={pending}
        onCancel={onClose}
        submitLabel={existing ? t("common.save") : t("common.create")}
      >
        <Field id={labelId} label={t("finance.label")}>
          <TextInput
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("finance.labelPlaceholder")}
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={amountId} label={t("finance.amount")}>
            <MoneyInput id={amountId} value={amount} onChange={setAmount} min={0} />
          </Field>
          <Field id={catId} label={t("finance.direction")}>
            <Dropdown
              id={catId}
              value={direction}
              onChange={(v) => {
                setDirection(v as Direction);
                setCategoryId(null);
              }}
              options={[
                { value: "out", label: `− ${t("finance.money_out")}` },
                { value: "in", label: `+ ${t("finance.money_in")}` },
              ]}
              label={t("finance.direction")}
              placeholder={t("finance.money_out")}
            />
          </Field>
        </div>

        <Field id={`${catId}-cat`} label={t("finance.category")}>
          <Dropdown
            id={`${catId}-cat`}
            value={categoryId}
            onChange={(v) => setCategoryId(v || null)}
            options={relevant.map((c) => ({ value: c.id, label: c.name }))}
            label={t("finance.category")}
            placeholder={t("common.choose")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={cadenceId} label={t("finance.cadence")}>
            <Dropdown
              id={cadenceId}
              value={cadence}
              onChange={(v) => setCadence(v as Cadence)}
              options={[
                { value: "monthly", label: t("finance.monthly") },
                { value: "quarterly", label: t("finance.quarterly") },
                { value: "yearly", label: t("finance.yearly") },
              ]}
              label={t("finance.cadence")}
              placeholder={t("finance.monthly")}
            />
          </Field>
          <Field
            id={dayId}
            label={t("finance.dayOfMonth")}
            hint={t("finance.dayOfMonthHint")}
          >
            <NumberInput
              id={dayId}
              value={dayOfMonth}
              onChange={setDayOfMonth}
              min={1}
              max={31}
              allowDecimal={false}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={startId} label={t("finance.startsOn")}>
            <DatePicker
              id={startId}
              value={startsOn}
              onChange={(v) => setStartsOn(v ?? todayInIstanbul())}
              clearable={false}
            />
          </Field>
          <Field
            id={endId}
            label={t("finance.endsOn")}
            hint={t("finance.endsOnHint")}
          >
            <DatePicker id={endId} value={endsOn} onChange={setEndsOn} min={startsOn} />
          </Field>
        </div>
      </CreateForm>
    </CreateOverlay>
  );
}
