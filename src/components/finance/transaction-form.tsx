"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ReceiptField } from "@/components/finance/receipt-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/actions/finance";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Category, Direction, Transaction } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, todayInIstanbul } from "@/lib/utils";

export function TransactionForm({
  categories,
  existing,
}: {
  categories: Category[];
  existing?: Transaction;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  // ⚠️ Ids come from useId(), never hardcoded — `Field` requires the caller to
  // supply one so two forms on a page can't make every label point at the
  // first one's input.
  const dateId = useId();
  const descId = useId();
  const amountId = useId();
  const catId = useId();
  const noteId = useId();

  const [occurredOn, setOccurredOn] = useState(
    existing?.occurred_on ?? todayInIstanbul()
  );
  const [direction, setDirection] = useState<Direction>(existing?.direction ?? "out");
  // Kuruş → lira for the input; converted back exactly once, in the action.
  const [amount, setAmount] = useState<number | null>(
    existing ? toMajor(existing.amount_minor) : null
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.category_id ?? null
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [receiptPath, setReceiptPath] = useState<string | null>(
    existing?.receipt_path ?? null
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Only categories matching the current direction — asking "what sector is
  // this?" of the wrong kind is noise. Archived ones are already excluded by
  // the caller, EXCEPT the one this row already uses (below).
  const relevant = categories.filter(
    (c) => c.kind === (direction === "in" ? "income" : "expense")
  );
  // ⚠️ Keep an archived category visible if THIS row still uses it — otherwise
  // opening an old transaction would silently blank its category on save.
  const current = categories.find((c) => c.id === categoryId);
  const options = [
    ...relevant,
    ...(current && !relevant.some((c) => c.id === current.id) ? [current] : []),
  ];

  const emptyFields: string[] = [];
  if (!description.trim()) emptyFields.push(t("finance.description"));
  if (amount == null || amount === 0) emptyFields.push(t("finance.amount"));

  const submit = async () => {
    const input = {
      occurredOn,
      direction,
      amount: amount ?? 0,
      description,
      categoryId,
      note: note || null,
      receiptPath,
    };

    const result = await run(
      () => (existing ? updateTransaction(existing.id, input) : createTransaction(input)),
      {
        successMessage: existing ? t("finance.saved") : t("finance.created"),
        errorMessage: t("finance.saveFailed"),
      }
    );

    if (result.ok) {
      router.push("/finance");
      router.refresh();
    }
  };

  const remove = async () => {
    const result = await run(() => deleteTransaction(existing!.id), {
      successMessage: t("finance.deleted"),
      errorMessage: t("finance.saveFailed"),
    });
    if (result.ok) {
      router.push("/finance");
      router.refresh();
    }
  };

  return (
    <>
      <CreateForm
        onSubmit={submit}
        emptyFields={emptyFields}
        pending={pending}
        submitLabel={existing ? t("common.save") : t("finance.newTransaction")}
      >
        {/* Direction first: it changes which categories are offered, so asking
            it last would mean re-picking the category. */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-muted">
            {t("finance.direction")}
          </legend>
          <div className="flex gap-2">
            <DirectionChip
              active={direction === "out"}
              onClick={() => {
                setDirection("out");
                setCategoryId(null);
              }}
              label={t("finance.money_out")}
              tone="out"
            />
            <DirectionChip
              active={direction === "in"}
              onClick={() => {
                setDirection("in");
                setCategoryId(null);
              }}
              label={t("finance.money_in")}
              tone="in"
            />
          </div>
        </fieldset>

        <Field id={descId} label={t("finance.description")}>
          <TextInput
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("finance.descriptionPlaceholder")}
            autoFocus
            maxLength={200}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={amountId} label={t("finance.amount")}>
            <MoneyInput id={amountId} value={amount} onChange={setAmount} min={0} />
          </Field>
          <Field id={dateId} label={t("finance.date")}>
            <DatePicker
              id={dateId}
              value={occurredOn}
              onChange={(v) => setOccurredOn(v ?? todayInIstanbul())}
              clearable={false}
            />
          </Field>
        </div>

        <Field id={catId} label={t("finance.category")}>
          <Dropdown
            id={catId}
            value={categoryId}
            onChange={(v) => setCategoryId(v || null)}
            options={options.map((c) => ({
              value: c.id,
              label: c.name,
              hint: c.archived_at ? t("finance.archived") : undefined,
            }))}
            label={t("finance.category")}
            placeholder={t("common.choose")}
          />
        </Field>

        <Field id={noteId} label={t("finance.note")} optional={t("common.optional")}>
          <TextArea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("finance.notePlaceholder")}
            rows={3}
          />
        </Field>

        <ReceiptField value={receiptPath} onChange={setReceiptPath} />
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
        title={t("finance.deleteTransaction")}
        // ⚠️ A row created by another section says so plainly: deleting it here
        // removes only the financial record, and its cause may recreate it.
        body={
          existing?.source_type
            ? t("finance.deleteLinkedBody", { section: existing.source_type })
            : t("finance.deleteBody")
        }
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}

function DirectionChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "in" | "out";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press flex-1 rounded-lg border px-3 py-2 text-sm transition-colors duration-[var(--dur-fast)]",
        active
          ? tone === "in"
            ? "border-success bg-success-soft font-medium text-ink"
            : "border-danger bg-danger-soft font-medium text-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      )}
    >
      {/* The sign is part of the label, so the choice is never colour-only. */}
      <span aria-hidden className="me-1">
        {tone === "in" ? "+" : "−"}
      </span>
      {label}
    </button>
  );
}
