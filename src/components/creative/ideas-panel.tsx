"use client";

import { ArrowRight, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { IdeaForm } from "@/components/creative/idea-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateOverlay } from "@/components/ui/create";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteIdea, promoteIdea, updateIdeaStatus } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import type { Idea, IdeaStatus } from "@/lib/types";
import { IDEA_STATUSES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate } from "@/lib/utils";

const STATUS_KEY: Record<IdeaStatus, string> = {
  new: "creative.statusNew",
  exploring: "creative.statusExploring",
  dropped: "creative.statusDropped",
  made: "creative.statusMade",
};

export function IdeasPanel({ ideas: initial }: { ideas: Idea[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const [ideas, setIdeas] = useState(initial);
  const [filter, setFilter] = useState<IdeaStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null);
  /** The idea open in the edit overlay, or null. */
  const [editing, setEditing] = useState<Idea | null>(null);
  /** Which row is mid-promote — see `promote` below. */
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setIdeas(initial);
  }

  const visible = filter
    ? ideas.filter((i) => i.status === filter)
    : // Dropped ideas are hidden by default — you decided against them, and
      // they shouldn't compete for attention with live ones.
      ideas.filter((i) => i.status !== "dropped");

  const setStatus = (idea: Idea, status: IdeaStatus) => {
    const previous = ideas;
    void run(() => updateIdeaStatus(idea.id, status), {
      optimistic: () =>
        setIdeas((list) =>
          list.map((i) => (i.id === idea.id ? { ...i, status } : i))
        ),
      rollback: () => setIdeas(previous),
      errorMessage: t("creative.saveFailed"),
    });
  };

  /**
   * "Make it" — the idea becomes a collection and we go straight there.
   *
   * NOT optimistic: it creates a real row and then navigates, so painting
   * success early would mean showing a link to a collection that might not
   * exist. The server is the only thing that knows the new id.
   *
   * ⚠️ Tracks WHICH idea is promoting, not merely WHETHER one is. `pending`
   * from useAction is panel-level, so wiring it straight to every row's button
   * spun all of them at once — including rows never touched. It read as "the
   * whole list is saving".
   */
  const promote = async (idea: Idea) => {
    setPromotingId(idea.id);
    // Awaited and cleared in a finally: a REJECTED promote must release the
    // spinner too, or that row stays busy forever with no way back.
    try {
      await run(() => promoteIdea(idea.id), {
        successMessage: t("creative.promoted"),
        errorMessage: t("creative.saveFailed"),
        onSuccess: ({ collectionId }) => {
          router.push(`/creative/collections/${collectionId}`);
          router.refresh();
        },
      });
    } finally {
      setPromotingId(null);
    }
  };

  const remove = (idea: Idea) => {
    const previous = ideas;
    setConfirmDelete(null);
    void run(() => deleteIdea(idea.id), {
      optimistic: () => setIdeas((list) => list.filter((i) => i.id !== idea.id)),
      rollback: () => setIdeas(previous),
      successMessage: t("creative.deleted"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  if (ideas.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb aria-hidden className="size-4" />}
        title={t("creative.noIdeas")}
        description={t("creative.noIdeasHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === null} onClick={() => setFilter(null)}>
          {t("creative.allIssues")}
        </FilterChip>
        {IDEA_STATUSES.map((value) => (
          <FilterChip
            key={value}
            active={filter === value}
            onClick={() => setFilter(filter === value ? null : value)}
          >
            {t(STATUS_KEY[value] as never)}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t("common.noResults")}
          action={
            <Button size="sm" onClick={() => setFilter(null)}>
              {t("common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((idea) => (
            <li
              key={idea.id}
              className="rounded-xl border border-line bg-surface p-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      idea.status === "dropped"
                        ? "text-faint line-through"
                        : "text-ink"
                    )}
                  >
                    {idea.title}
                  </p>
                  {idea.body && (
                    <p className="mt-0.5 text-xs text-muted">{idea.body}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-faint">
                    <span>{formatDate(idea.created_at, locale)}</span>
                    {idea.collection_id && (
                      <Link
                        href={`/creative/collections/${idea.collection_id}`}
                        className="text-accent hover:underline"
                      >
                        {t("creative.madeInto")}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Promote only shows while it's still an idea — once made,
                      the link above takes you to what it became. */}
                  {!idea.collection_id && idea.status !== "dropped" && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void promote(idea)}
                      loading={promotingId === idea.id}
                      icon={<ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />}
                    >
                      {t("creative.makeIt")}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(idea)}
                    aria-label={t("common.edit")}
                    className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Pencil aria-hidden className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(idea)}
                    aria-label={t("common.delete")}
                    className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {IDEA_STATUSES.filter((s) => s !== "made").map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(idea, value)}
                    aria-pressed={idea.status === value}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-2xs transition-colors",
                      idea.status === value
                        ? "border-brand bg-brand-soft text-ink"
                        : "border-line text-muted hover:text-ink"
                    )}
                  >
                    {t(STATUS_KEY[value] as never)}
                  </button>
                ))}
                {idea.status === "made" && (
                  <Badge tone="accent">{t("creative.statusMade")}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateOverlay
        open={!!editing}
        title={t("creative.editIdea")}
        onClose={() => setEditing(null)}
      >
        {/* `key` re-seeds the form's state when switching which idea is open —
            without it, opening a second idea would keep the first one's text. */}
        {editing && (
          <IdeaForm
            key={editing.id}
            existing={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </CreateOverlay>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("creative.deleteIdea")}
        body={t("common.deleteWarning")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
