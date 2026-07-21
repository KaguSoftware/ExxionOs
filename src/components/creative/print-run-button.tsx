"use client";

import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/field";
import { TextInput } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { recordPrintRun } from "@/lib/actions/creative";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import type { PrintOutcome } from "@/lib/types";
import { PRINT_OUTCOMES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, todayInIstanbul } from "@/lib/utils";

/**
 * ⚠️ ALL THREE OUTCOMES BURN FILAMENT; only `good` makes sellable units. The
 * hints say so on screen, because "why did my stock not go up?" is the exact
 * question this control exists to pre-empt.
 */
const OUTCOME_LABEL: Record<PrintOutcome, string> = {
  good: "creative.outcomeGood",
  test: "creative.outcomeTest",
  failed: "creative.outcomeFailed",
};

const OUTCOME_HINT: Record<PrintOutcome, string> = {
  good: "creative.outcomeGoodHint",
  test: "creative.outcomeTestHint",
  failed: "creative.outcomeFailedHint",
};

/**
 * "I printed N of these."
 *
 * ⚠️ THIS is where filament leaves stock — not when the product is created.
 * A product is a design; printing it is the event that consumes material.
 */
export function PrintRunButton({
  productId,
  gramsEach,
  supplyName,
}: {
  productId: string;
  gramsEach: number | null;
  /** Null when the material isn't linked to a tracked supply. */
  supplyName: string | null;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { run, pending } = useAction();

  const unitsId = useId();
  const dateId = useId();
  const notesId = useId();

  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<number | null>(1);
  const [outcome, setOutcome] = useState<PrintOutcome>("good");
  const [printedOn, setPrintedOn] = useState(todayInIstanbul());
  const [notes, setNotes] = useState("");

  const submit = async () => {
    const count = units ?? 1;
    const result = await run(
      () => recordPrintRun({ productId, units: count, outcome, printedOn, notes }),
      { errorMessage: t("creative.saveFailed") }
    );

    if (result.ok) {
      // The message reports what ACTUALLY happened — the filament that left,
      // AND whether any units arrived. Silence on either would look like a bug,
      // and "nothing was added to stock" is the surprising half.
      const { gramsUsed, supplyName: used, unitsAdded } = result.data;
      const filament =
        used && gramsUsed
          ? t("creative.deducted", { units: count, grams: gramsUsed, supply: used })
          : t("creative.deductedNoStock", { units: count });
      const stock =
        unitsAdded > 0
          ? t("creative.stockAdded", { units: count, added: unitsAdded })
          : t("creative.stockNotAdded", { units: count });

      toast.success(`${filament} ${stock}`);
      setOpen(false);
      setUnits(1);
      setOutcome("good");
      setNotes("");
      router.refresh();
    }
  };

  const preview =
    gramsEach != null && units != null ? Math.round(gramsEach * units) : null;

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        icon={<Printer aria-hidden className="size-3.5" />}
      >
        {t("creative.printRun")}
      </Button>

      {open && (
        <CreateOverlay
          open
          title={t("creative.logPrintRun")}
          description={t("creative.printRunHint")}
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col gap-4">
            <Field id={unitsId} label={t("creative.units")}>
              <NumberInput
                id={unitsId}
                value={units}
                onChange={setUnits}
                min={1}
                allowDecimal={false}
              />
            </Field>

            {/* ⚠️ A RADIO GROUP, NOT A DROPDOWN. Three options whose
                CONSEQUENCES differ, and the difference ("this one adds no
                stock") is exactly what a collapsed dropdown would hide until
                after the choice was made. */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-muted">
                {t("creative.outcome")}
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {PRINT_OUTCOMES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOutcome(value)}
                    aria-pressed={outcome === value}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs transition-colors",
                      outcome === value
                        ? "border-brand bg-brand-soft text-ink"
                        : "border-line text-muted hover:border-line-strong hover:text-ink"
                    )}
                  >
                    {t(OUTCOME_LABEL[value] as never)}
                  </button>
                ))}
              </div>
              {/* The consequence of the CURRENT choice, always visible. */}
              <p className="text-xs text-faint">
                {t(OUTCOME_HINT[outcome] as never)}
              </p>
            </fieldset>

            <Field id={dateId} label={t("creative.printedOn")}>
              <DatePicker
                id={dateId}
                value={printedOn}
                onChange={(v) => setPrintedOn(v ?? todayInIstanbul())}
                clearable={false}
              />
            </Field>

            <Field id={notesId} label={t("creative.ideaBody")} optional={t("common.optional")}>
              <TextInput
                id={notesId}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {/* Says what will happen before it happens — BOTH halves: the
                filament leaving, and whether any units arrive. "Nothing was
                deducted" and "nothing was added" are different sentences and
                both are surprising if unsaid. */}
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
              {supplyName && preview != null
                ? t("creative.deducted", {
                    units: units ?? 1,
                    grams: preview,
                    supply: supplyName,
                  })
                : t("creative.noStockLinked")}{" "}
              {outcome === "good"
                ? t("creative.stockAdded", {
                    units: units ?? 1,
                    added: units ?? 1,
                  })
                : t("creative.stockNotAdded", { units: units ?? 1 })}
            </p>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={submit} loading={pending}>
                {t("creative.logPrintRun")}
              </Button>
            </div>
          </div>
        </CreateOverlay>
      )}
    </>
  );
}
