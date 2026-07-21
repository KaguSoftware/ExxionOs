"use client";

import { AlertCircle, FolderOpen, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import type { Collection, CollectionStatus, Issue, Product } from "@/lib/types";
import { COLLECTION_STATUSES } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const STATUS_KEY: Record<CollectionStatus, string> = {
  planned: "creative.planned",
  in_progress: "creative.in_progress",
  done: "creative.done",
  archived: "creative.archivedStatus",
};

export function CollectionsPanel({
  collections,
  products,
  issues,
}: {
  collections: Collection[];
  products: Product[];
  issues: Issue[];
}) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<CollectionStatus | null>(null);

  // Client-side filtering over rows already in memory — no round-trip.
  const visible = status
    ? collections.filter((c) => c.status === status)
    : // Archived collections are hidden by default: they're done, and a folder
      // you finished last year shouldn't crowd out this month's work. The
      // filter chip makes them one click away.
      collections.filter((c) => c.status !== "archived");

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen aria-hidden className="size-4" />}
        title={t("creative.noCollections")}
        description={t("creative.noCollectionsHint")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={status === null} onClick={() => setStatus(null)}>
          {t("creative.allIssues")}
        </FilterChip>
        {COLLECTION_STATUSES.map((value) => (
          <FilterChip
            key={value}
            active={status === value}
            onClick={() => setStatus(status === value ? null : value)}
          >
            {t(STATUS_KEY[value] as never)}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        // ⚠️ A filtered-to-nothing state must offer the way OUT of the filter.
        // "No results" alone is a dead end — see the note in ui/empty-state.
        <EmptyState
          title={t("common.noResults")}
          action={
            <Button size="sm" onClick={() => setStatus(null)}>
              {t("common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((collection) => {
            const productCount = products.filter(
              (p) => p.collection_id === collection.id
            ).length;
            const openIssues = issues.filter(
              (i) => i.collection_id === collection.id && !i.resolved_at
            ).length;

            return (
              <li key={collection.id}>
                <Link
                  href={`/creative/collections/${collection.id}`}
                  className={cn(
                    "flex h-full flex-col rounded-xl border border-line bg-surface p-4",
                    "transition-colors hover:border-line-strong hover:bg-raised"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={collection.name}>
                      {collection.name}
                    </h3>
                    <Badge>{t(STATUS_KEY[collection.status] as never)}</Badge>
                  </div>

                  {collection.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {collection.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-faint">
                    <span className="flex items-center gap-1">
                      <Package aria-hidden className="size-3.5" />
                      {productCount}
                    </span>
                    {/* Open issues only. A count of solved problems would nag
                        about work that is already finished. */}
                    {openIssues > 0 && (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertCircle aria-hidden className="size-3.5" />
                        {openIssues}
                      </span>
                    )}
                    {collection.started_on && (
                      <span className="ms-auto">
                        {formatDate(collection.started_on, locale)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors duration-[var(--dur-fast)]",
        active
          ? "border-brand bg-brand-soft font-medium text-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
