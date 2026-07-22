"use client";

import { Download, PackageCheck } from "lucide-react";
import { useState } from "react";

import { RestockForm } from "@/components/equipment/supplies-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { restockSupply } from "@/lib/actions/equipment";
import { downloadCsv, toCsv } from "@/lib/csv";
import { isLowStock, suggestedReorder } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Supply } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatMinor } from "@/lib/utils";

/**
 * The reorder list — everything below its warning level, in one place, as a
 * shopping list. Filament running out mid-print is the workshop's most
 * expensive failure, so this turns the scattered low-stock badges into a single
 * actionable view: what to buy, how much, and roughly what it will cost.
 *
 * ⚠️ Reuses `isLowStock` (the ONE definition of "low") and the SAME
 * `RestockForm` the Supplies tab uses, so restocking here behaves identically —
 * no second restock path to drift.
 */
export function ReorderPanel({ supplies: initial }: { supplies: Supply[] }) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [supplies, setSupplies] = useState(initial);
  const [restocking, setRestocking] = useState<Supply | null>(null);

  // Adopt server truth during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setSupplies(initial);
  }

  const low = supplies
    .filter((s) => !s.archived_at && isLowStock(s))
    // Deepest shortfall first — the most urgent buy leads the list.
    .sort((a, b) => {
      const sa = suggestedReorder(a) ?? 0;
      const sb = suggestedReorder(b) ?? 0;
      return sb - sa;
    });

  if (low.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck aria-hidden className="size-4" />}
        title={t("equipment.reorderClear")}
        description={t("equipment.reorderClearHint")}
      />
    );
  }

  // Rough total of the suggested buy — last unit price × suggested quantity,
  // over the items we CAN price. Items with no last price are excluded and
  // stated, so the figure never poses as complete.
  let estimateMinor = 0;
  let uncosted = 0;
  for (const s of low) {
    const qty = suggestedReorder(s);
    if (s.last_price_minor != null && qty != null) estimateMinor += s.last_price_minor * qty;
    else uncosted++;
  }

  const exportList = () => {
    const rows = low.map((s) => [
      s.name,
      s.category ?? "",
      String(s.quantity),
      s.low_threshold == null ? "" : String(s.low_threshold),
      String(suggestedReorder(s) ?? ""),
      s.unit,
      s.last_price_minor == null ? "" : (s.last_price_minor / 100).toFixed(2),
    ]);
    downloadCsv(
      toCsv(
        ["Name", "Category", "On hand", "Threshold", "Suggested", "Unit", "Last price (TRY)"],
        rows
      ),
      "reorder"
    );
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {t("equipment.reorderEstimate")}{" "}
          <span className="tnum font-medium text-ink">{formatMinor(estimateMinor)}</span>
          {uncosted > 0 && (
            <span className="text-faint">
              {" · "}
              {t("equipment.reorderUncosted", { count: uncosted })}
            </span>
          )}
        </p>
        <Button
          size="sm"
          onClick={exportList}
          icon={<Download aria-hidden className="size-3.5" />}
        >
          {t("common.exportCsv")}
        </Button>
      </div>

      <ul className="overflow-hidden rounded-xl border border-line">
        {low.map((supply) => {
          const qty = suggestedReorder(supply);
          return (
            <li
              key={supply.id}
              className="row-comfortable flex flex-wrap items-center gap-3 border-b border-line last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-ink" title={supply.name}>
                    {supply.name}
                  </span>
                  <Badge tone="warning">{t("equipment.lowStock")}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {t("equipment.inStock", {
                    quantity: String(supply.quantity),
                    unit: supply.unit,
                  })}
                  {supply.low_threshold != null && (
                    <span className="text-faint">
                      {" · "}
                      {t("equipment.lowThreshold")} {String(supply.low_threshold)}
                    </span>
                  )}
                </p>
              </div>

              {qty != null && qty > 0 && (
                <span className="shrink-0 text-xs text-muted">
                  {t("equipment.reorderSuggested", {
                    quantity: String(qty),
                    unit: supply.unit,
                  })}
                </span>
              )}

              {supply.last_price_minor != null && (
                <span className="tnum shrink-0 text-xs text-faint">
                  {formatMinor(supply.last_price_minor)}
                </span>
              )}

              <Button size="sm" onClick={() => setRestocking(supply)} className="shrink-0">
                {t("equipment.restock")}
              </Button>
            </li>
          );
        })}
      </ul>

      {restocking && (
        <RestockForm
          supply={restocking}
          pending={pending}
          onClose={() => setRestocking(null)}
          onSubmit={async (quantity, cost) => {
            const result = await run(
              () => restockSupply({ supplyId: restocking.id, quantity, cost }),
              {
                successMessage: t("equipment.restocked"),
                errorMessage: t("equipment.saveFailed"),
              }
            );
            if (result.ok) setRestocking(null);
          }}
        />
      )}
    </>
  );
}
