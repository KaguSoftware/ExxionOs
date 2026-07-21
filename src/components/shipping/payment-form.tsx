"use client";

import { useState } from "react";

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
import { todayInIstanbul } from "@/lib/utils";

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

  const submit = async () => {
    if (!amount) return;
    const result = await run(
      () =>
        recordPayment({
          orderId,
          amount,
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
      <div className="flex flex-col gap-4">
        <Field id="payment-amount" label={t("shipping.paymentAmount")}>
          <MoneyInput
            id="payment-amount"
            value={amount}
            onChange={setAmount}
            min={0}
          />
        </Field>

        <Field id="payment-kind" label={t("shipping.paymentKind")}>
          <Dropdown
            id="payment-kind"
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

        <Field id="payment-date" label={t("shipping.paidOn")}>
          <DatePicker
            id="payment-date"
            value={paidOn}
            onChange={setPaidOn}
            placeholder={t("common.chooseDate")}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={pending}
            disabled={!amount}
          >
            {t("shipping.recordPayment")}
          </Button>
        </div>
      </div>
    </CreateOverlay>
  );
}
