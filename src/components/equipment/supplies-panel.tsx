"use client";

import { Archive, PackagePlus, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { CreateOverlay } from "@/components/ui/create";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { archiveSupply, restockSupply } from "@/lib/actions/equipment";
import { isLowStock } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Supply } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatMinor } from "@/lib/utils";

export function SuppliesPanel({ supplies: initial }: { supplies: Supply[] }) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [supplies, setSupplies] = useState(initial);
  const [restocking, setRestocking] = useState<Supply | null>(null);

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setSupplies(initial);
  }

  const archive = (supply: Supply) => {
    const previous = supplies;
    void run(() => archiveSupply(supply.id, true), {
      optimistic: () => setSupplies((list) => list.filter((s) => s.id !== supply.id)),
      rollback: () => setSupplies(previous),
      successMessage: t("equipment.saved"),
      errorMessage: t("equipment.saveFailed"),
    });
  };

  if (supplies.length === 0) {
    return (
      <EmptyState
        icon={<PackagePlus aria-hidden className="size-4" />}
        title={t("equipment.noSupplies")}
        description={t("equipment.noSuppliesHint")}
      />
    );
  }

  // Low stock first — the question this tab answers is "what am I about to run
  // out of", not "what do I own".
  const sorted = [...supplies].sort((a, b) => {
    const lowA = isLowStock(a) ? 0 : 1;
    const lowB = isLowStock(b) ? 0 : 1;
    return lowA - lowB || a.name.localeCompare(b.name);
  });

  return (
    <>
      <ul className="rounded-xl border border-line">
        {sorted.map((supply) => {
          const low = isLowStock(supply);
          return (
            <li
              key={supply.id}
              className="flex flex-wrap items-center gap-3 row-comfortable border-b border-line last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-ink" title={supply.name}>{supply.name}</span>
                  {/* Word + tone, never colour alone. */}
                  {low && <Badge tone="warning">{t("equipment.lowStock")}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {t("equipment.inStock", {
                    quantity: formatQuantity(supply.quantity),
                    unit: supply.unit,
                  })}
                  {supply.low_threshold != null && (
                    <span className="text-faint">
                      {" · "}
                      {t("equipment.lowThreshold")}{" "}
                      {formatQuantity(supply.low_threshold)}
                    </span>
                  )}
                </p>
              </div>

              {supply.last_price_minor != null && (
                <span className="tnum shrink-0 text-xs text-faint">
                  {formatMinor(supply.last_price_minor)}
                </span>
              )}

              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" onClick={() => setRestocking(supply)}>
                  {t("equipment.restock")}
                </Button>
                <Link
                  href={`/equipment/supplies/${supply.id}`}
                  aria-label={t("common.edit")}
                  className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                >
                  <Pencil aria-hidden className="size-3.5" />
                </Link>
                {/* Archive, never delete — restock history references it. */}
                <button
                  type="button"
                  onClick={() => archive(supply)}
                  aria-label={t("finance.archive")}
                  title={t("finance.archive")}
                  className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                >
                  <Archive aria-hidden className="size-3.5" />
                </button>
              </div>
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

function RestockForm({
  supply,
  pending,
  onClose,
  onSubmit,
}: {
  supply: Supply;
  pending: boolean;
  onClose: () => void;
  onSubmit: (quantity: number, cost: number | null) => void;
}) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(
    supply.last_price_minor != null ? toMajor(supply.last_price_minor) : null
  );

  return (
    <CreateOverlay
      open
      title={`${t("equipment.restock")} — ${supply.name}`}
      description={t("equipment.costHint")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <Field id="restock-qty" label={t("equipment.restockQuantity")}>
          <NumberInput
            id="restock-qty"
            value={quantity}
            onChange={setQuantity}
            min={0}
            suffix={supply.unit}
          />
        </Field>

        <Field
          id="restock-cost"
          label={t("equipment.restockCost")}
          optional={t("common.optional")}
          hint={t("equipment.costHint")}
        >
          <MoneyInput id="restock-cost" value={cost} onChange={setCost} min={0} />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!quantity}
            onClick={() => quantity && onSubmit(quantity, cost)}
          >
            {t("equipment.restock")}
          </Button>
        </div>
      </div>
    </CreateOverlay>
  );
}

/**
 * `numeric` arrives as a string; trim a trailing ".00" for display.
 *
 * ⚠️ Both branches of this ternary used to be `String(n)`, so the function was
 * a no-op that only LOOKED like it formatted — "12.50" rendered as "12.5" and
 * a whole number kept whatever the column gave it. Stock quantity is the one
 * number this panel exists to show.
 *
 * Two decimals at most, and none when the value is whole: you hold 12 boxes,
 * not 12.00 boxes, but you can hold 12.5 kg.
 */
function formatQuantity(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export { formatQuantity };
