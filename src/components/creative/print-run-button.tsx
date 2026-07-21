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
import { useAction } from "@/lib/use-action";
import { todayInIstanbul } from "@/lib/utils";

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
  const [printedOn, setPrintedOn] = useState(todayInIstanbul());
  const [notes, setNotes] = useState("");

  const submit = async () => {
    const count = units ?? 1;
    const result = await run(
      () => recordPrintRun({ productId, units: count, printedOn, notes }),
      { errorMessage: t("creative.saveFailed") }
    );

    if (result.ok) {
      // The message reports what ACTUALLY happened, including the case where
      // nothing was deducted — silence there would look like a bug.
      const { gramsUsed, supplyName: used } = result.data;
      toast.success(
        used && gramsUsed
          ? t("creative.deducted", {
              units: count,
              grams: gramsUsed,
              supply: used,
            })
          : t("creative.deductedNoStock", { units: count })
      );
      setOpen(false);
      setUnits(1);
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

            {/* Says what will happen before it happens — including "nothing",
                so an unlinked material isn't a silent surprise. */}
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
              {supplyName && preview != null
                ? t("creative.deducted", {
                    units: units ?? 1,
                    grams: preview,
                    supply: supplyName,
                  })
                : t("creative.noStockLinked")}
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
