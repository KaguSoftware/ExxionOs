"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import { updateMachineRate } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import { useAction } from "@/lib/use-action";

/**
 * The machine hourly rate — one of the two inputs to computed product cost.
 *
 * ⚠️ The other input, the per-kg material cost, now lives on the SUPPLY it's
 * printed from (Equipment → Supplies), so filament is entered once. This panel
 * is deliberately just the machine rate; changing it re-costs every product,
 * which is why the action revalidates the Creative pages too.
 */
export function CostingForm({ machineRateMinor }: { machineRateMinor: number }) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [rate, setRate] = useState<number | null>(toMajor(machineRateMinor));
  const rateDirty = (rate ?? 0) !== toMajor(machineRateMinor);

  const saveRate = () => {
    void run(() => updateMachineRate(rate ?? 0), {
      successMessage: t("creative.saved"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  return (
    <Panel title={t("creative.costing")} description={t("creative.costingSubtitle")}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted">
            {t("creative.machineHourRate")}
          </label>
          <MoneyInput value={rate} onChange={setRate} min={0} />
          <p className="mt-1 text-xs text-faint">
            {t("creative.machineHourRateHint")}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={saveRate}
          loading={pending}
          disabled={!rateDirty}
        >
          {t("common.save")}
        </Button>
      </div>
      <p className="mt-4 border-t border-line pt-4 text-xs text-faint">
        {t("creative.materialsMovedHint")}
      </p>
    </Panel>
  );
}
