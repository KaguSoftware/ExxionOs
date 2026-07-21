"use client";

import { Boxes, ChevronRight, ClipboardCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateOverlay } from "@/components/ui/create";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { TextInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deletePrintRun } from "@/lib/actions/creative";
import { correctProductStock } from "@/lib/actions/stock";
import { useI18n } from "@/lib/i18n/client";
import { isLow, onHandByProduct, stockBreakdown } from "@/lib/stock";
import type { Locale } from "@/lib/i18n";
import type {
  Collection,
  PrintOutcome,
  PrintRun,
  Product,
  ProductStockMovement,
} from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate } from "@/lib/utils";

const OUTCOME_KEY: Record<PrintOutcome, string> = {
  good: "creative.outcomeGood",
  test: "creative.outcomeTest",
  failed: "creative.outcomeFailed",
};

/**
 * Every product's finished-unit count, in one place.
 *
 * ⚠️ ON-HAND IS SUMMED FROM THE LEDGER, never read from a column — see
 * `lib/stock.ts`. That is why a product with no movements reads "none on hand"
 * rather than being absent: no movements is a real answer, not missing data.
 *
 * Ordered by what needs you: out of stock, then low, then everything else.
 * Same "what am I about to run out of" ordering as Equipment's supplies panel,
 * because it answers the same question about a different kind of thing.
 */
export function StockPanel({
  products,
  collections,
  movements,
  printRuns = [],
}: {
  products: Product[];
  collections: Collection[];
  movements: ProductStockMovement[];
  /** Every run, so a product's history can be expanded in place. */
  printRuns?: PrintRun[];
}) {
  const { t, locale } = useI18n();

  const [counting, setCounting] = useState<Product | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Boxes aria-hidden className="size-4" />}
        title={t("creative.stockEmpty")}
        description={t("creative.stockEmptyHint")}
      />
    );
  }

  const totals = onHandByProduct(movements);
  const collectionName = new Map(collections.map((c) => [c.id, c.name]));

  // Out of stock first, then low, then the rest — and alphabetical inside each
  // band so the list is stable between renders.
  const rank = (units: number) => (units <= 0 ? 0 : isLow(units) ? 1 : 2);
  const sorted = [...products].sort((a, b) => {
    const ua = totals.get(a.id) ?? 0;
    const ub = totals.get(b.id) ?? 0;
    return rank(ua) - rank(ub) || ua - ub || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-faint">{t("creative.stockHint")}</p>

      <ul className="rounded-xl border border-line">
        {sorted.map((product) => {
          const units = totals.get(product.id) ?? 0;
          const mine = movements.filter((m) => m.product_id === product.id);
          const breakdown = stockBreakdown(mine);

          // Only the parts that actually happened — a product that was never
          // sold should not read "0 sold", which is noise dressed as data.
          const why = [
            breakdown.made > 0 && t("creative.stockMade", { count: breakdown.made }),
            breakdown.sold > 0 && t("creative.stockSold", { count: breakdown.sold }),
            breakdown.given > 0 &&
              t("creative.stockGiven", { count: breakdown.given }),
            breakdown.corrected !== 0 &&
              t("creative.stockCorrected", { count: breakdown.corrected }),
          ].filter(Boolean);

          const runs = printRuns.filter((r) => r.product_id === product.id);
          const isOpen = expanded === product.id;

          return (
            <li
              key={product.id}
              className="border-b border-line last:border-0"
            >
              <div className="flex flex-wrap items-center gap-3 row-comfortable">
              {/* ⚠️ The whole label is the disclosure control, not a lone
                  chevron — a 14px target beside a full-width row is the
                  hardest possible way to open something. */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : product.id)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 text-faint transition-transform rtl:rotate-180",
                    isOpen && "rotate-90 rtl:rotate-90"
                  )}
                />
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm text-ink"
                    title={product.name}
                  >
                    {product.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-faint">
                    {product.collection_id && (
                      <span>{collectionName.get(product.collection_id)}</span>
                    )}
                    {why.length > 0 && <span>· {why.join(" · ")}</span>}
                  </span>
                </span>
              </button>

              {/* ⚠️ The NUMBER is the primary signal and the badge is the
                  secondary one — colour alone never carries the state. */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "tnum text-sm font-semibold",
                    units <= 0 ? "text-danger" : "text-ink"
                  )}
                >
                  {units}
                </span>
                {units <= 0 ? (
                  <Badge tone="danger">{t("creative.outOfStock")}</Badge>
                ) : isLow(units) ? (
                  <Badge tone="warning">{t("creative.lowStock")}</Badge>
                ) : null}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCounting(product)}
                icon={<ClipboardCheck aria-hidden className="size-3.5" />}
              >
                {t("creative.countIt")}
              </Button>
              </div>

              {isOpen && <PrintHistory runs={runs} locale={locale} />}
            </li>
          );
        })}
      </ul>

      {counting && (
        <CountDialog
          product={counting}
          current={totals.get(counting.id) ?? 0}
          onClose={() => setCounting(null)}
        />
      )}
    </div>
  );
}

/**
 * A product's print runs — the first time this table has ever been READ.
 *
 * ⚠️ Until now `print_runs` was write-only: three references app-wide, all
 * writes, no page loading it. Filament left stock and the row that explained
 * why was invisible forever. This is also the only path to `deletePrintRun`,
 * which had no UI at all.
 */
function PrintHistory({ runs, locale }: { runs: PrintRun[]; locale: Locale }) {
  const { t } = useI18n();
  const { run: perform, pending } = useAction();
  const router = useRouter();

  const [confirming, setConfirming] = useState<PrintRun | null>(null);

  if (runs.length === 0) {
    return (
      <p className="border-t border-line px-4 pb-3 pt-2 text-xs text-faint">
        {t("creative.noPrintRuns")} {t("creative.noPrintRunsHint")}
      </p>
    );
  }

  const remove = (target: PrintRun) => {
    setConfirming(null);
    void perform(() => deletePrintRun(target.id), {
      successMessage: t("creative.runRemoved"),
      errorMessage: t("creative.saveFailed"),
      // Not optimistic: this both restores filament and removes units, and
      // guessing at two ledgers is worse than a brief wait.
      onSuccess: () => router.refresh(),
    });
  };

  // Newest first — the run you are most likely to be correcting is the one you
  // just logged.
  const sorted = [...runs].sort((a, b) =>
    b.printed_on.localeCompare(a.printed_on)
  );

  return (
    <div className="border-t border-line bg-raised/40">
      <ul>
        {sorted.map((printRun) => (
          <li
            key={printRun.id}
            className="flex flex-wrap items-center gap-2 row-compact ps-9"
          >
            <span className="text-xs text-muted">
              {formatDate(printRun.printed_on, locale)}
            </span>
            <span className="tnum text-xs text-ink">×{printRun.units}</span>
            {/* ⚠️ `neutral`: outcome is a CATEGORY, not a state. See badge.tsx
                — a coloured category badge collides with the state vocabulary
                the same strip uses for out-of-stock. */}
            <Badge>{t(OUTCOME_KEY[printRun.outcome] as never)}</Badge>
            {printRun.grams_used != null && (
              <span className="tnum text-2xs text-faint">
                {Number(printRun.grams_used)}g
              </span>
            )}
            {printRun.notes && (
              <span className="min-w-0 flex-1 truncate text-2xs text-faint">
                {printRun.notes}
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirming(printRun)}
              aria-label={t("creative.deleteRun")}
              className="ms-auto rounded p-1 text-faint transition-colors hover:bg-surface hover:text-danger"
            >
              <Trash2 aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!confirming}
        title={t("creative.deleteRun")}
        // Says BOTH consequences out loud: filament back, units gone. Either
        // one alone would be a half-truth about a number people rely on.
        body={t("creative.deleteRunBody")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)}
      />
    </div>
  );
}

/**
 * "I counted the shelf, it's actually N."
 *
 * ⚠️ The user types the TOTAL they counted; the action writes the DIFFERENCE.
 * Asking for a delta ("add 3") would make the person do arithmetic against a
 * number they already distrust — which is the whole reason they are counting.
 */
function CountDialog({
  product,
  current,
  onClose,
}: {
  product: Product;
  current: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { run, pending } = useAction();

  const countId = useId();
  const noteId = useId();

  const [counted, setCounted] = useState<number | null>(current);
  const [note, setNote] = useState("");

  const submit = async () => {
    const result = await run(
      () =>
        correctProductStock({
          productId: product.id,
          countedUnits: counted ?? 0,
          note,
        }),
      { errorMessage: t("creative.saveFailed") }
    );

    if (result.ok) {
      // Reports the CHANGE, not the new total — "adjusted by −2" is the fact
      // that was in doubt. Zero gets its own sentence rather than a silent
      // close that would look like the save failed.
      toast.success(
        result.data.delta === 0
          ? t("creative.stockAlreadyRight")
          : t("creative.stockCorrectedBy", {
              delta: result.data.delta > 0 ? `+${result.data.delta}` : result.data.delta,
            })
      );
      onClose();
      router.refresh();
    }
  };

  return (
    <CreateOverlay
      open
      title={product.name}
      description={t("creative.countedHint")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <Field
          id={countId}
          label={t("creative.countedUnits")}
          hint={t("creative.unitsOnHand", { count: current })}
        >
          <NumberInput
            id={countId}
            value={counted}
            onChange={setCounted}
            min={0}
            allowDecimal={false}
          />
        </Field>

        <Field id={noteId} label={t("creative.stockLedger")} optional={t("common.optional")}>
          <TextInput
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </CreateOverlay>
  );
}
