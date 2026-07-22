"use client";

import { CheckCircle2, ChevronDown, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextArea, TextInput } from "@/components/ui/input";
import { deleteIssue, resolveIssue } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import type { Collection, Issue, Product, Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate } from "@/lib/utils";

const SEVERITY_KEY: Record<Severity, string> = {
  low: "creative.low",
  medium: "creative.medium",
  high: "creative.high",
};

/**
 * Learnings — every issue in the shop, with its fix.
 *
 * ⚠️ This is a LENS over the same `issues` rows a collection's Issues tab
 * shows. There is no separate "learnings" table, deliberately: anything that
 * had to be copied here could be forgotten, and an issue missing from Learnings
 * defeats the one thing this section is for ("keeps us consistent").
 *
 * Unsolved sort FIRST — an open problem is a question waiting for an answer,
 * and a solved one is reference material.
 */
export function LearningsPanel({
  issues: initial,
  collections,
  products,
  collectionId,
}: {
  issues: Issue[];
  collections: Collection[];
  /** Only used to name the product an issue points at. */
  products: Product[];
  /** When set, only this collection's issues (the collection's Issues tab). */
  collectionId?: string;
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();

  const [issues, setIssues] = useState(initial);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [solvedFilter, setSolvedFilter] = useState<"all" | "open" | "solved">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Issue | null>(null);

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setIssues(initial);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues
      .filter((issue) => {
        if (collectionId && issue.collection_id !== collectionId) return false;
        if (severity && issue.severity !== severity) return false;
        if (solvedFilter === "open" && issue.resolved_at) return false;
        if (solvedFilter === "solved" && !issue.resolved_at) return false;
        if (needle) {
          const haystack = `${issue.title} ${issue.body ?? ""} ${issue.resolution ?? ""}`;
          if (!haystack.toLowerCase().includes(needle)) return false;
        }
        return true;
      })
      // Unsolved first, then newest. An open problem needs an answer; a solved
      // one is reference.
      .sort((a, b) => {
        const aOpen = a.resolved_at ? 1 : 0;
        const bOpen = b.resolved_at ? 1 : 0;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [issues, query, severity, solvedFilter, collectionId]);

  const remove = (issue: Issue) => {
    const previous = issues;
    setConfirmDelete(null);
    void run(() => deleteIssue(issue.id), {
      optimistic: () => setIssues((list) => list.filter((i) => i.id !== issue.id)),
      rollback: () => setIssues(previous),
      successMessage: t("creative.deleted"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  const scopedEmpty = collectionId
    ? t("creative.noIssuesInCollection")
    : t("creative.noIssues");

  if (issues.filter((i) => !collectionId || i.collection_id === collectionId).length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 aria-hidden className="size-4" />}
        title={scopedEmpty}
        description={t("creative.noIssuesHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          aria-label={t("common.search")}
          leading={<Search aria-hidden className="size-3.5" />}
          className="min-w-48 flex-1"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={solvedFilter === "all"}
            onClick={() => setSolvedFilter("all")}
          >
            {t("creative.allIssues")}
          </FilterChip>
          <FilterChip
            active={solvedFilter === "open"}
            onClick={() => setSolvedFilter("open")}
          >
            {t("creative.unsolved")}
          </FilterChip>
          <FilterChip
            active={solvedFilter === "solved"}
            onClick={() => setSolvedFilter("solved")}
          >
            {t("creative.solved")}
          </FilterChip>
          {SEVERITIES.map((value) => (
            <FilterChip
              key={value}
              active={severity === value}
              onClick={() => setSeverity(severity === value ? null : value)}
            >
              {t(SEVERITY_KEY[value] as never)}
            </FilterChip>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.noResults")}
          action={
            // Resets ALL THREE filters — clearing only one would leave the
            // list still empty and the button looking broken.
            <Button
              size="sm"
              onClick={() => {
                setQuery("");
                setSeverity(null);
                setSolvedFilter("all");
              }}
            >
              {t("common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              collection={collections.find((c) => c.id === issue.collection_id) ?? null}
              product={products.find((p) => p.id === issue.product_id) ?? null}
              expanded={openId === issue.id}
              onToggle={() => setOpenId(openId === issue.id ? null : issue.id)}
              onDelete={() => setConfirmDelete(issue)}
              onResolved={(resolution) =>
                setIssues((list) =>
                  list.map((i) =>
                    i.id === issue.id
                      ? {
                          ...i,
                          resolution: resolution || null,
                          resolved_at: resolution ? new Date().toISOString() : null,
                        }
                      : i
                  )
                )
              }
              locale={locale}
              showCollection={!collectionId}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("creative.deleteIssue")}
        body={t("creative.deleteIssueBody")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}

function IssueRow({
  issue,
  collection,
  product,
  expanded,
  onToggle,
  onDelete,
  onResolved,
  locale,
  showCollection,
}: {
  issue: Issue;
  collection: Collection | null;
  product: Product | null;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onResolved: (resolution: string) => void;
  locale: "en" | "fa";
  showCollection: boolean;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [draft, setDraft] = useState(issue.resolution ?? "");
  // ⚠️ From useId, never hardcoded — many issue rows render at once. See the
  // note in ui/field.tsx about labels pointing at the FIRST instance.
  const resolutionId = useId();

  const solved = !!issue.resolved_at;

  const save = () => {
    const text = draft.trim();
    void run(() => resolveIssue(issue.id, text), {
      // Optimistic: answering "how did we fix it" IS marking it solved, so the
      // row should flip the instant you save.
      optimistic: () => onResolved(text),
      successMessage: t("creative.saved"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-start"
        >
          <div className="flex items-center gap-2">
            {/* State is carried by an ICON + WORD, not colour alone. */}
            {solved ? (
              <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-success" />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  issue.severity === "high" ? "bg-danger" : "bg-warning"
                )}
              />
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                solved ? "text-muted" : "font-medium text-ink"
              )}
            >
              {issue.title}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-faint transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 ps-5 text-xs text-faint">
            {/* ⚠️ SOLVED-NESS IS STATE; SEVERITY IS A CATEGORY. They must not
                share the palette. The old code coloured severity with the
                reserved state hues — so a high-severity SOLVED issue was green
                and a high-severity OPEN one was red, the same attribute in
                opposite colours, exactly the collision badge.tsx documents.
                `success` now means only "solved"; severity rides `neutral` and
                is carried by its word. */}
            <Badge tone={solved ? "success" : "neutral"}>
              {solved ? t("creative.solved") : t(SEVERITY_KEY[issue.severity] as never)}
            </Badge>
            {showCollection && (
              <span>
                {collection ? collection.name : t("creative.generalIssue")}
              </span>
            )}
            {product && <span>· {product.name}</span>}
            <span>· {formatDate(issue.created_at, locale)}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={t("common.delete")}
          className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-danger"
        >
          <Trash2 aria-hidden className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-line p-3">
          {issue.body && (
            <p className="mb-3 text-sm whitespace-pre-wrap text-muted">{issue.body}</p>
          )}

          {collection && showCollection && (
            <Link
              href={`/creative/collections/${collection.id}`}
              className="mb-3 inline-block text-xs text-accent hover:underline"
            >
              {collection.name}
            </Link>
          )}

          {/* ⚠️ `htmlFor` + `id` from useId — this was the one control in the
              section not wired through <Field>, so the label pointed at
              nothing: clicking it didn't focus, and a screen reader announced
              an unlabelled textarea. Hardcoding an id is not an option here,
              since every expanded issue row renders one of these. */}
          <label
            htmlFor={resolutionId}
            className="mb-1.5 block text-xs font-medium text-muted"
          >
            {t("creative.howDidWeFixIt")}
          </label>
          <TextArea
            id={resolutionId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("creative.resolutionPlaceholder")}
            rows={3}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {/* Says out loud that clearing the text reopens the issue — the
                behaviour is deliberate but not guessable. */}
            <p className="text-xs text-faint">{t("creative.reopenHint")}</p>
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              loading={pending}
              disabled={draft.trim() === (issue.resolution ?? "")}
            >
              {t("creative.markSolved")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
