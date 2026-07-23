"use client";

import { Package, Pencil } from "lucide-react";
import Link from "next/link";

import { PrintRunButton } from "@/components/creative/print-run-button";
import { ProductFilesButton } from "@/components/creative/product-files-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { productCost, productMargin, productMarginPct } from "@/lib/costing";
import { useI18n } from "@/lib/i18n/client";
import { isLow, onHandByProduct } from "@/lib/stock";
import type {
  Product,
  ProductFile,
  ProductStockMovement,
  StoredImage,
  Supply,
} from "@/lib/types";
import { cn, formatMinor } from "@/lib/utils";

export function ProductsPanel({
  products,
  supplies = [],
  machineRateMinor,
  laborRateMinor,
  images,
  files = [],
  collectionId,
  stockMovements = [],
}: {
  products: Product[];
  /** Prices the products AND names the stock a print run draws from. */
  supplies?: Supply[];
  machineRateMinor: number;
  laborRateMinor: number;
  images: (StoredImage & { product_id: string })[];
  /** Source/design files (.mb/.ma/.stl) per product. */
  files?: ProductFile[];
  collectionId: string;
  /** The stock ledger; on-hand is summed from it, never stored. */
  stockMovements?: ProductStockMovement[];
}) {
  const { t } = useI18n();

  const onHand = onHandByProduct(stockMovements);

  // Group files by product once, newest first (they arrive already ordered).
  const filesByProduct = new Map<string, ProductFile[]>();
  for (const file of files) {
    const list = filesByProduct.get(file.product_id);
    if (list) list.push(file);
    else filesByProduct.set(file.product_id, [file]);
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package aria-hidden className="size-4" />}
        title={t("creative.noProducts")}
        description={t("creative.noProductsHint")}
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        // ⚠️ COMPUTED HERE, EVERY RENDER — never read from a column. Re-pricing
        // a supply updates every one of these with no writes and no
        // migration. See lib/costing.ts.
        const cost = productCost(product, supplies, machineRateMinor, laborRateMinor);
        const margin = productMargin(product, cost);
        const marginPct = productMarginPct(product, cost);
        const supply = supplies.find((s) => s.id === product.supply_id);
        const photoCount = images.filter((i) => i.product_id === product.id).length;
        // Summed from the ledger, like cost above — never a stored column.
        const units = onHand.get(product.id) ?? 0;

        return (
          <li
            key={product.id}
            className="flex flex-col rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-ink" title={product.name}>
                  {product.name}
                </h3>
                {product.kind && (
                  <p className="text-xs text-muted">{product.kind}</p>
                )}
              </div>
              <Link
                href={`/creative/collections/${collectionId}/products/${product.id}`}
                aria-label={t("common.edit")}
                className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
              >
                <Pencil aria-hidden className="size-3.5" />
              </Link>
            </div>

            <dl className="mt-3 flex flex-col gap-1 text-xs">
              <Row label={t("creative.price")}>
                {product.price_minor == null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span className="tnum text-ink">
                    {formatMinor(product.price_minor)}
                  </span>
                )}
              </Row>

              {/* ⚠️ Stock sits ABOVE cost: "do we have one" is the question
                  asked far more often than "what did it cost", and it is the
                  one that decides whether you can promise an order today. */}
              <Row label={t("creative.onHand")}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "tnum",
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
                </span>
              </Row>

              <Row label={t("creative.unitCost")}>
                {cost == null ? (
                  // ⚠️ "Not costed", NEVER ₺0,00 — zero would claim the thing
                  // is free, which is a different and much worse statement
                  // than "we haven't worked it out".
                  <span className="text-faint">{t("creative.costUnknown")}</span>
                ) : (
                  <span className="tnum text-ink">{formatMinor(cost.totalMinor)}</span>
                )}
              </Row>

              {margin != null && (
                <Row label={t("creative.margin")}>
                  <span
                    className={cn(
                      "tnum",
                      // Sign carries the meaning; colour only reinforces it.
                      margin >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {margin >= 0 ? "+" : "−"}
                    {formatMinor(Math.abs(margin))}
                    {marginPct != null && (
                      <span className="ms-1 text-faint">({marginPct}%)</span>
                    )}
                  </span>
                </Row>
              )}
            </dl>

            {cost != null && (
              <p className="mt-2 text-2xs text-faint">
                {t("creative.costBreakdown", {
                  material: formatMinor(cost.materialMinor),
                  machine: formatMinor(cost.machineMinor),
                })}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-faint">
              {supply && <span>{supply.name}</span>}
              {/* The MEASURED weight wins — it's the truth, supports included.
                  A dot marks it as weighed-not-estimated so the two never read
                  the same. Falls back to the estimate until a print is weighed. */}
              {product.measured_grams ? (
                <span>· {Number(product.measured_grams)}g ●</span>
              ) : (
                product.grams && <span>· {product.grams}g</span>
              )}
              {product.print_hours && <span>· {product.print_hours}h</span>}
              {photoCount > 0 && <span className="ms-auto">{photoCount} 📷</span>}
            </div>

            {/* Printing is what consumes filament — so the action lives on the
                product. The supply it draws from is the product's own supply.
                The design files (.mb/.ma/.stl) sit beside it: the source lives
                with the product. */}
            <div className="mt-3 flex items-center gap-1 border-t border-line pt-2">
              <PrintRunButton
                productId={product.id}
                estimateGrams={Number(product.grams) || null}
                measuredGrams={Number(product.measured_grams) || null}
                supplyName={supply?.name ?? null}
              />
              <ProductFilesButton
                productId={product.id}
                files={filesByProduct.get(product.id) ?? []}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
