"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import { updateCostingRates } from "@/lib/actions/settings";
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
export function CostingForm({
  machineRateMinor,
  laborRateMinor,
}: {
  machineRateMinor: number;
  laborRateMinor: number;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [machineRate, setMachineRate] = useState<number | null>(
    toMajor(machineRateMinor)
  );
  const [laborRate, setLaborRate] = useState<number | null>(
    toMajor(laborRateMinor)
  );
  const dirty =
    (machineRate ?? 0) !== toMajor(machineRateMinor) ||
    (laborRate ?? 0) !== toMajor(laborRateMinor);

  const save = () => {
    void run(
      () =>
        updateCostingRates({
          machineRate: machineRate ?? 0,
          laborRate: laborRate ?? 0,
        }),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );
  };

  return (
    <Panel title={t("creative.costing")} description={t("creative.costingSubtitle")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            {t("creative.machineHourRate")}
          </label>
          <MoneyInput value={machineRate} onChange={setMachineRate} min={0} />
          <p className="mt-1 text-xs text-faint">
            {t("creative.machineHourRateHint")}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            {t("settings.laborRate")}
          </label>
          <MoneyInput value={laborRate} onChange={setLaborRate} min={0} />
          <p className="mt-1 text-xs text-faint">{t("settings.laborRateHint")}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={save} loading={pending} disabled={!dirty}>
          {t("common.save")}
        </Button>
      </div>
      <p className="mt-4 border-t border-line pt-4 text-xs text-faint">
        {t("creative.materialsMovedHint")}
      </p>
    </Panel>
  );
}
