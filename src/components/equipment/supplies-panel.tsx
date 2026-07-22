"use client";

import { Archive, PackagePlus, Pencil } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

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
import { cn, formatMinor } from "@/lib/utils";

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

  // Grouped by type — filament, cardboard, stickers… Types sort alphabetically;
  // the uncategorised bucket sinks to the bottom (an empty type isn't a name).
  // Within each group, low stock first — the question this tab answers is "what
  // am I about to run out of", not "what do I own".
  const groups = groupByCategory(supplies, t("equipment.uncategorised"));

  return (
    <>
      <div className="flex flex-col gap-6">
        {groups.map(({ label, key, items }) => (
          <section key={key}>
            <h3 className="mb-2 text-xs font-medium text-muted">{label}</h3>
            <ul className="overflow-hidden rounded-xl border border-line">
              {items.map((supply) => {
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
          </section>
        ))}
      </div>

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
  const qtyId = useId();
  const costId = useId();
  const [quantity, setQuantity] = useState<number | null>(null);
  // "total" = the price for the whole restock; "unit" = the price of ONE unit,
  // multiplied by quantity on submit. last_price_minor is a total, so we
  // pre-fill in total mode.
  const [costMode, setCostMode] = useState<"total" | "unit">("total");
  const [cost, setCost] = useState<number | null>(
    supply.last_price_minor != null ? toMajor(supply.last_price_minor) : null
  );

  // What the action always receives: the batch total.
  const totalCost =
    cost == null ? null : costMode === "unit" ? cost * (quantity ?? 0) : cost;

  return (
    <CreateOverlay
      open
      title={`${t("equipment.restock")} — ${supply.name}`}
      description={t("equipment.costHint")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* useId, not literal ids: this form renders inside a list, and two
            mounted at once would point both labels at the first input. */}
        <Field id={qtyId} label={t("equipment.restockQuantity")}>
          <NumberInput
            id={qtyId}
            value={quantity}
            onChange={setQuantity}
            min={0}
            suffix={supply.unit}
          />
        </Field>

        <Field
          id={costId}
          label={
            costMode === "unit"
              ? t("equipment.costPerUnit", { unit: supply.unit })
              : t("equipment.costTotal")
          }
          optional={t("common.optional")}
          // In unit mode, show what the batch will come to, so the number
          // that lands in Finance is never a surprise.
          hint={
            costMode === "unit" && totalCost != null
              ? t("equipment.costTotalIs", { total: formatMinor(Math.round(totalCost * 100)) })
              : t("equipment.costHint")
          }
        >
          <div className="flex flex-col gap-2">
            {/* Total vs per-unit — a lightweight segment, not a new primitive. */}
            <div className="inline-flex self-start rounded-lg border border-line p-0.5">
              {(["total", "unit"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCostMode(mode)}
                  aria-pressed={costMode === mode}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    costMode === mode
                      ? "bg-raised text-ink"
                      : "text-muted hover:text-ink"
                  )}
                >
                  {mode === "total"
                    ? t("equipment.costModeTotal")
                    : t("equipment.costModePerUnit", { unit: supply.unit })}
                </button>
              ))}
            </div>
            <MoneyInput id={costId} value={cost} onChange={setCost} min={0} />
          </div>
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          {/* ⚠️ NOT `disabled={!quantity}`. A disabled primary button with no
              explanation is the blocking validator this app forbids — every
              other authoring surface asks once and then proceeds. It also
              rejected a legitimate 0 (a stock correction), since !0 is true. */}
          <Button
            variant="primary"
            loading={pending}
            onClick={() => onSubmit(quantity ?? 0, totalCost)}
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

/**
 * Bucket supplies by their `category` (the Finance category). Categories sort
 * alphabetically; the uncategorised bucket (null/blank) always sinks last — an
 * empty category is not a name to sort by. Within a bucket, low stock leads.
 */
function groupByCategory(
  supplies: Supply[],
  uncategorisedLabel: string
): { key: string; label: string; items: Supply[] }[] {
  const buckets = new Map<string, Supply[]>();
  for (const supply of supplies) {
    const key = supply.category?.trim() || "";
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(supply);
  }

  const sortItems = (list: Supply[]) =>
    [...list].sort((a, b) => {
      const lowA = isLowStock(a) ? 0 : 1;
      const lowB = isLowStock(b) ? 0 : 1;
      return lowA - lowB || a.name.localeCompare(b.name);
    });

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      // Empty type ("") sorts after every real label.
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    })
    .map(([key, items]) => ({
      key: key || " uncategorised",
      label: key || uncategorisedLabel,
      items: sortItems(items),
    }));
}
