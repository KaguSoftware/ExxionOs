"use client";

import { ArrowLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { CollectionPnl, type SoldLine } from "@/components/creative/collection-pnl";
import { LearningsPanel } from "@/components/creative/learnings-panel";
import { ProductsPanel } from "@/components/creative/products-panel";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type {
  Collection,
  CollectionStatus,
  Issue,
  Material,
  Product,
  ProductStockMovement,
  StoredImage,
} from "@/lib/types";

const STATUS_KEY: Record<CollectionStatus, string> = {
  planned: "creative.planned",
  in_progress: "creative.in_progress",
  done: "creative.done",
  archived: "creative.archivedStatus",
};

export function CollectionDetail({
  collection,
  products,
  issues,
  materials,
  machineRateMinor,
  images,
  supplies,
  soldLines,
  stockMovements = [],
}: {
  collection: Collection;
  products: Product[];
  issues: Issue[];
  materials: Material[];
  machineRateMinor: number;
  images: (StoredImage & { product_id: string })[];
  supplies: { id: string; name: string }[];
  /** Every order line app-wide; filtered to this collection by the P&L panel. */
  soldLines: SoldLine[];
  /** The stock ledger; on-hand per product is summed from it. */
  stockMovements?: ProductStockMovement[];
}) {
  const { t } = useI18n();

  const openIssues = issues.filter((i) => !i.resolved_at).length;

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Link
          href="/creative"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("creative.collections")}
        </Link>
      </div>

      <TabbedPanels
        title={collection.name}
        description={
          collection.description ?? t(STATUS_KEY[collection.status] as never)
        }
        tabs={[
          {
            id: "products",
            label: t("creative.products"),
            count: products.length,
            action: (
              <div className="flex items-center gap-2">
                <Link href={`/creative/collections/${collection.id}/edit`}>
                  <Button size="sm" icon={<Pencil aria-hidden className="size-3.5" />}>
                    {t("common.edit")}
                  </Button>
                </Link>
                <Link href={`/creative/collections/${collection.id}/products/new`}>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus aria-hidden className="size-3.5" />}
                  >
                    {t("creative.newProduct")}
                  </Button>
                </Link>
              </div>
            ),
            content: (
              <ProductsPanel
                products={products}
                materials={materials}
                machineRateMinor={machineRateMinor}
                images={images}
                collectionId={collection.id}
                supplies={supplies}
                stockMovements={stockMovements}
              />
            ),
          },
          {
            id: "issues",
            label: t("creative.issues"),
            count: openIssues,
            action: (
              <Link href={`/creative/issues/new?collection=${collection.id}`}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus aria-hidden className="size-3.5" />}
                >
                  {t("creative.newIssue")}
                </Button>
              </Link>
            ),
            // ⚠️ The SAME component Learnings uses, scoped by collectionId.
            // Two lenses on one table — not a second implementation that could
            // drift from the first.
            content: (
              <LearningsPanel
                issues={issues}
                collections={[collection]}
                products={products}
                collectionId={collection.id}
              />
            ),
          },
          {
            id: "pnl",
            label: t("creative.pnl"),
            content: (
              <CollectionPnl
                products={products}
                materials={materials}
                machineRateMinor={machineRateMinor}
                soldLines={soldLines}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
