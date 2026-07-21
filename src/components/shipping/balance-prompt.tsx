"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateOverlay } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import { recordPayment } from "@/lib/actions/shipping";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Order } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatMinor } from "@/lib/utils";

/**
 * ⚠️ THE SENTENCE THAT KEEPS THE MONEY RIGHT.
 *
 * Shown when an order reaches `delivered`. It offers to record what is STILL
 * OWED — never the order total — because Exxion takes deposits and a naive
 * "log the total on delivery" would book the deposit twice.
 *
 * The amount arrives pre-computed by `setOrderStage`, and the body text says
 * out loud that the deposit has been subtracted, so the number is never a
 * mystery the user has to trust.
 */
export function BalancePrompt({
  order,
  outstandingMinor,
  onClose,
}: {
  order: Order;
  outstandingMinor: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [amount, setAmount] = useState<number | null>(toMajor(outstandingMinor));

  const nothingOwed = outstandingMinor <= 0;

  const submit = async () => {
    if (!amount) return;
    const result = await run(
      () =>
        recordPayment({
          orderId: order.id,
          amount,
          // A delivery payment settles the order; a deposit is recorded from
          // the order page before the work is done.
          kind: "balance",
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
      title={t("shipping.deliveredPrompt")}
      description={
        nothingOwed
          ? t("shipping.deliveredPaidBody")
          : t("shipping.deliveredPromptBody", {
              outstanding: formatMinor(outstandingMinor),
            })
      }
      onClose={onClose}
    >
      {nothingOwed ? (
        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="primary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field id="balance-amount" label={t("shipping.paymentAmount")}>
            <MoneyInput
              id="balance-amount"
              value={amount}
              onChange={setAmount}
              min={0}
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {t("shipping.skipForNow")}
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={pending}
              disabled={!amount}
            >
              {t("shipping.recordBalance", {
                amount: formatMinor(Math.round((amount ?? 0) * 100)),
              })}
            </Button>
          </div>
        </div>
      )}
    </CreateOverlay>
  );
}
