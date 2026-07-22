"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import { recordPayment } from "@/lib/actions/shipping";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import { PAYMENT_KINDS, type PaymentKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatMinor, todayInIstanbul } from "@/lib/utils";

const KIND_KEY: Record<PaymentKind, string> = {
  deposit: "shipping.kindDeposit",
  balance: "shipping.kindBalance",
  refund: "shipping.kindRefund",
};

export function PaymentForm({
  orderId,
  suggestedMinor,
  hasPayments,
  onClose,
}: {
  orderId: string;
  /** What is still owed — the sensible default for a balance payment. */
  suggestedMinor: number;
  hasPayments: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const amountId = useId();
  const kindId = useId();
  const dateId = useId();

  const [amount, setAmount] = useState<number | null>(
    suggestedMinor > 0 ? toMajor(suggestedMinor) : null
  );
  /**
   * The FIRST payment on an order is usually the deposit; a later one is
   * usually the balance. Guessing right saves a click and gets the Finance
   * description right more often than not — it stays editable either way.
   */
  const [kind, setKind] = useState<PaymentKind>(hasPayments ? "balance" : "deposit");
  const [paidOn, setPaidOn] = useState<string | null>(todayInIstanbul());

  // Warn, never block (the no-required-fields spirit): a legitimate overpay
  // exists, but outstandingMinor() floors at 0 so it would otherwise vanish
  // from the order with no trace. Refunds are money OUT — never "over".
  const overpaying =
    amount != null &&
    kind !== "refund" &&
    suggestedMinor > 0 &&
    Math.round(amount * 100) > suggestedMinor;

  const submit = async () => {
    // No `if (!amount) return` blocker — an empty amount records a 0, the same
    // ask-once-then-proceed contract the rest of the app follows.
    const result = await run(
      () =>
        recordPayment({
          orderId,
          amount: amount ?? 0,
          kind,
          paidOn: paidOn ?? undefined,
        }),
      {
        successMessage: t("shipping.paymentRecorded"),
        errorMessage: t("shipping.saveFailed"),
      }
    );
    if (result.ok) onClose();
  };

  return (
    <CreateOverlay
      open
      title={t("shipping.recordPayment")}
      description={t("shipping.revenueHint")}
      onClose={onClose}
    >
      {/* A real <form> so Enter in the amount field submits, like every
          CreateForm surface. */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id={amountId} label={t("shipping.paymentAmount")}>
          <MoneyInput
            id={amountId}
            value={amount}
            onChange={setAmount}
            min={0}
            autoFocus
          />
          {overpaying && (
            <p className="mt-1.5 text-xs text-warning">
              {t("shipping.overpaymentWarning", {
                outstanding: formatMinor(suggestedMinor),
              })}
            </p>
          )}
        </Field>

        <Field id={kindId} label={t("shipping.paymentKind")}>
          <Dropdown
            id={kindId}
            value={kind}
            onChange={(v) => setKind(v as PaymentKind)}
            options={PAYMENT_KINDS.map((k) => ({
              value: k,
              label: t(KIND_KEY[k] as never),
            }))}
            label={t("shipping.paymentKind")}
            placeholder={t("shipping.kindBalance")}
          />
        </Field>

        <Field id={dateId} label={t("shipping.paidOn")}>
          <DatePicker
            id={dateId}
            value={paidOn}
            onChange={setPaidOn}
            placeholder={t("common.chooseDate")}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {t("shipping.recordPayment")}
          </Button>
        </div>
      </form>
    </CreateOverlay>
  );
}
