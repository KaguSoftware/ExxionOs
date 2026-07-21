"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { CollectionsPanel } from "@/components/creative/collections-panel";
import { IdeasPanel } from "@/components/creative/ideas-panel";
import { LearningsPanel } from "@/components/creative/learnings-panel";
import { StockPanel } from "@/components/creative/stock-panel";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { VocabularyManager } from "@/components/ui/vocabulary-manager";
import { useI18n } from "@/lib/i18n/client";
import { isLow, onHandByProduct } from "@/lib/stock";
import type {
  Collection,
  Idea,
  Issue,
  PrintRun,
  Product,
  ProductStockMovement,
  Vocabulary,
} from "@/lib/types";

export function CreativePanels({
  collections,
  ideas,
  issues,
  products,
  productTypes = [],
  stockMovements = [],
  printRuns = [],
}: {
  collections: Collection[];
  ideas: Idea[];
  issues: Issue[];
  products: Product[];
  /** The managed product-type list — see the "types" tab. */
  productTypes?: Vocabulary[];
  /** The append-only ledger; on-hand is summed from it. */
  stockMovements?: ProductStockMovement[];
  /** Print runs, shown when a stock row is expanded. */
  printRuns?: PrintRun[];
}) {
  const { t } = useI18n();

  const openIssues = issues.filter((i) => !i.resolved_at).length;

  // The tab badge counts what NEEDS YOU — products at or below the line — not
  // how many products exist. A count of everything would sit there as a
  // permanent number nobody can act on.
  const onHand = onHandByProduct(stockMovements);
  const needsRestock = products.filter((p) => {
    const units = onHand.get(p.id) ?? 0;
    return units <= 0 || isLow(units);
  }).length;

  return (
    <TabbedPanels
      title={t("creative.title")}
      description={t("creative.subtitle")}
      tabs={[
        {
          id: "collections",
          label: t("creative.collections"),
          count: collections.length,
          action: (
            <Link href="/creative/collections/new">
              <Button
                size="sm"
                variant="primary"
                icon={<Plus aria-hidden className="size-3.5" />}
              >
                {t("creative.newCollection")}
              </Button>
            </Link>
          ),
          content: (
            <CollectionsPanel
              collections={collections}
              products={products}
              issues={issues}
            />
          ),
        },
        {
          id: "ideas",
          label: t("creative.ideas"),
          count: ideas.filter((i) => i.status === "new" || i.status === "exploring")
            .length,
          action: (
            <Link href="/creative/ideas/new">
              <Button
                size="sm"
                variant="primary"
                icon={<Plus aria-hidden className="size-3.5" />}
              >
                {t("creative.newIdea")}
              </Button>
            </Link>
          ),
          content: <IdeasPanel ideas={ideas} />,
        },
        {
          id: "learnings",
          label: t("creative.learnings"),
          // The count is OPEN issues, not all of them: a solved issue needs
          // nothing from you, and a badge counting solved problems would nag
          // about work that is finished.
          count: openIssues,
          action: (
            <Link href="/creative/issues/new">
              <Button
                size="sm"
                variant="primary"
                icon={<Plus aria-hidden className="size-3.5" />}
              >
                {t("creative.newIssue")}
              </Button>
            </Link>
          ),
          content: (
            <LearningsPanel
              issues={issues}
              collections={collections}
              products={products}
            />
          ),
        },
        {
          id: "stock",
          label: t("creative.stock"),
          count: needsRestock,
          content: (
            <StockPanel
              products={products}
              collections={collections}
              movements={stockMovements}
              printRuns={printRuns}
            />
          ),
        },
        {
          id: "types",
          label: t("vocab.productTypes"),
          content: (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-faint">{t("vocab.manageHint")}</p>
              <VocabularyManager
                kind="product_type"
                items={productTypes}
                title={t("vocab.productTypes")}
                addLabel={t("vocab.productTypeName")}
                emptyTitle={t("vocab.noProductTypes")}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
