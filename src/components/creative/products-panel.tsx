"use client";

import { Package, Pencil } from "lucide-react";
import Link from "next/link";

import { PrintRunButton } from "@/components/creative/print-run-button";
import { EmptyState } from "@/components/ui/empty-state";
import { productCost, productMargin } from "@/lib/costing";
import { useI18n } from "@/lib/i18n/client";
import type { Material, Product, StoredImage } from "@/lib/types";
import { cn, formatMinor } from "@/lib/utils";

export function ProductsPanel({
  products,
  materials,
  machineRateMinor,
  images,
  collectionId,
  supplies = [],
}: {
  products: Product[];
  materials: Material[];
  machineRateMinor: number;
  images: (StoredImage & { product_id: string })[];
  collectionId: string;
  /** Used to name the stock a print run will draw from. */
  supplies?: { id: string; name: string }[];
}) {
  const { t } = useI18n();

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
        // a material updates every one of these with no writes and no
        // migration. See lib/costing.ts.
        const cost = productCost(product, materials, machineRateMinor);
        const margin = productMargin(product, cost);
        const material = materials.find((m) => m.id === product.material_id);
        const photoCount = images.filter((i) => i.product_id === product.id).length;

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
              {material && <span>{material.name}</span>}
              {product.grams && <span>· {product.grams}g</span>}
              {product.print_hours && <span>· {product.print_hours}h</span>}
              {photoCount > 0 && <span className="ms-auto">{photoCount} 📷</span>}
            </div>

            {/* Printing is what consumes filament — so the action lives on the
                product, not on the material. */}
            <div className="mt-3 border-t border-line pt-2">
              <PrintRunButton
                productId={product.id}
                gramsEach={Number(product.grams) || null}
                supplyName={
                  material?.supply_id
                    ? (supplies.find((s) => s.id === material.supply_id)?.name ?? null)
                    : null
                }
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
