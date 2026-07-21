"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { CollectionsPanel } from "@/components/creative/collections-panel";
import { IdeasPanel } from "@/components/creative/ideas-panel";
import { LearningsPanel } from "@/components/creative/learnings-panel";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { VocabularyManager } from "@/components/ui/vocabulary-manager";
import { useI18n } from "@/lib/i18n/client";
import type {
  Collection,
  Idea,
  Issue,
  Product,
  Vocabulary,
} from "@/lib/types";

export function CreativePanels({
  collections,
  ideas,
  issues,
  products,
  productTypes = [],
}: {
  collections: Collection[];
  ideas: Idea[];
  issues: Issue[];
  products: Product[];
  /** The managed product-type list — see the "types" tab. */
  productTypes?: Vocabulary[];
}) {
  const { t } = useI18n();

  const openIssues = issues.filter((i) => !i.resolved_at).length;

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
