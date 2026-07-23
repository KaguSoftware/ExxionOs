"use client";

import { useId, useMemo, useState } from "react";

import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import { productCost } from "@/lib/costing";
import { useI18n } from "@/lib/i18n/client";
import type { Supply } from "@/lib/types";
import { cn, formatMinor } from "@/lib/utils";

/**
 * Prices a hypothetical piece. Builds a product-shaped object and runs it
 * through the SAME `productCost` the real products use, so a quote here and a
 * product card can never disagree. Adds a target-margin input on top: the
 * suggested price is `cost / (1 − margin)`, the standard markup-from-margin.
 */
export function PricingCalculator({
  supplies,
  machineRateMinor,
  laborRateMinor,
}: {
  supplies: Supply[];
  machineRateMinor: number;
  laborRateMinor: number;
}) {
  const { t } = useI18n();

  const gramsId = useId();
  const hoursId = useId();
  const laborId = useId();
  const supplyId = useId();
  const marginId = useId();

  const [grams, setGrams] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [laborHours, setLaborHours] = useState<number | null>(null);
  const [supply, setSupply] = useState<string | null>(
    supplies[0]?.id ?? null
  );
  const [margin, setMargin] = useState<number | null>(50);

  const cost = useMemo(
    () =>
      productCost(
        {
          grams,
          measured_grams: null,
          print_hours: hours,
          labor_hours: laborHours,
          supply_id: supply,
        },
        supplies,
        machineRateMinor,
        laborRateMinor
      ),
    [grams, hours, laborHours, supply, supplies, machineRateMinor, laborRateMinor]
  );

  // Suggested price = cost marked up by the target percent: price = cost ×
  // (1 + markup). This is MARKUP-on-cost, not gross-margin-on-price, so any
  // positive percent is valid and the price grows linearly — a 300% markup is
  // 4× cost. Null cost → no suggestion.
  const markupFrac = Math.max((margin ?? 0) / 100, 0);
  const suggestedMinor =
    cost == null ? null : Math.round(cost.totalMinor * (1 + markupFrac));
  const profitMinor =
    suggestedMinor == null || cost == null ? null : suggestedMinor - cost.totalMinor;

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t("tools.inputs")}>
        <div className="flex flex-col gap-4">
          <Field id={supplyId} label={t("creative.material")} optional={t("common.optional")}>
            <Dropdown
              id={supplyId}
              value={supply}
              onChange={(v) => setSupply(v || null)}
              options={supplies.map((s) => ({
                value: s.id,
                label: s.name,
                hint:
                  s.cost_per_kg_minor == null
                    ? undefined
                    : `${formatMinor(s.cost_per_kg_minor)}/kg`,
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
              <NumberInput id={hoursId} value={hours} onChange={setHours} min={0} step={0.5} />
            </Field>
            <Field id={laborId} label={t("creative.laborHours")} optional={t("common.optional")}>
              <NumberInput
                id={laborId}
                value={laborHours}
                onChange={setLaborHours}
                min={0}
                step={0.5}
              />
            </Field>
          </div>

          <Field
            id={marginId}
            label={t("tools.targetMargin")}
            hint={t("tools.targetMarginHint")}
          >
            <NumberInput
              id={marginId}
              value={margin}
              onChange={setMargin}
              min={0}
              max={300}
              step={5}
              suffix="%"
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t("tools.result")}>
        {cost == null ? (
          <p className="text-sm text-faint">{t("tools.needInputs")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Line label={t("creative.material")} value={formatMinor(cost.materialMinor)} />
            <Line label={t("creative.machineHourRate")} value={formatMinor(cost.machineMinor)} />
            {cost.laborMinor > 0 && (
              <Line label={t("creative.laborCost")} value={formatMinor(cost.laborMinor)} />
            )}
            <Line
              label={t("creative.unitCost")}
              value={formatMinor(cost.totalMinor)}
              strong
            />

            <div className="mt-2 rounded-lg border border-brand-line bg-brand-soft p-4">
              <p className="text-xs text-muted">{t("tools.suggestedPrice")}</p>
              <p className="tnum mt-1 text-2xl font-semibold text-ink">
                {formatMinor(suggestedMinor)}
              </p>
              {profitMinor != null && (
                <p className="mt-1 text-xs text-muted">
                  {t("tools.profitPerUnit", { amount: formatMinor(profitMinor) })}
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        strong && "border-t border-line pt-3"
      )}
    >
      <span className={cn("text-sm", strong ? "font-medium text-ink" : "text-muted")}>
        {label}
      </span>
      <span
        className={cn(
          "tnum text-sm",
          strong ? "font-semibold text-ink" : "text-ink"
        )}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}
