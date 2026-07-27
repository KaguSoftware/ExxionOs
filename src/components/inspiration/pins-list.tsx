"use client";

import { ArrowRight, Lightbulb, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteIdea,
  promoteIdea,
  updateIdeaStatus,
} from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import type { Board, Idea, IdeaStatus } from "@/lib/types";
import { IDEA_STATUSES } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate } from "@/lib/utils";

const STATUS_KEY: Record<IdeaStatus, string> = {
  new: "inspiration.statusNew",
  exploring: "inspiration.statusExploring",
  dropped: "inspiration.statusDropped",
  made: "inspiration.statusMade",
};

/**
 * The TEXT LENS over the same rows the masonry shows.
 *
 * ⚠️ A FLAT COLUMN, NOT A GRID — deliberately the opposite of the board. The
 * masonry reads column-major, which is right for browsing pictures and wrong
 * for scanning a list of things you're thinking about. Two lenses, two reading
 * orders, one table.
 */
export function PinsList({
  pins: initial,
  boards,
}: {
  pins: Idea[];
  boards: Board[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run } = useAction();

  const [pins, setPins] = useState(initial);
  const [filter, setFilter] = useState<IdeaStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null);
  /** Which row is mid-promote — see `promote` below. */
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPins(initial);
  }

  const boardNames = new Map(boards.map((b) => [b.id, b.name] as const));

  const visible = filter
    ? pins.filter((p) => p.status === filter)
    : // Dropped pins are hidden by default — you decided against them, and they
      // shouldn't compete for attention with live ones.
      pins.filter((p) => p.status !== "dropped");

  const setStatus = (pin: Idea, status: IdeaStatus) => {
    const previous = pins;
    void run(() => updateIdeaStatus(pin.id, status), {
      optimistic: () =>
        setPins((list) =>
          list.map((p) => (p.id === pin.id ? { ...p, status } : p))
        ),
      rollback: () => setPins(previous),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  /**
   * "Make it" — the pin becomes a collection and we go straight there.
   *
   * NOT optimistic: it creates a real row and then navigates, so painting
   * success early would mean linking to a collection that might not exist.
   *
   * ⚠️ Tracks WHICH pin is promoting, not merely WHETHER one is. `pending` from
   * useAction is panel-level, so wiring it to every row's button spun all of
   * them at once — it read as "the whole list is saving".
   */
  const promote = async (pin: Idea) => {
    setPromotingId(pin.id);
    // Cleared in a finally: a REJECTED promote must release the spinner too,
    // or that row stays busy forever with no way back.
    try {
      await run(() => promoteIdea(pin.id), {
        successMessage: t("inspiration.promoted"),
        errorMessage: t("inspiration.saveFailed"),
        onSuccess: (data) => {
          const { collectionId } = data as { collectionId: string };
          router.push(`/creative/collections/${collectionId}`);
          router.refresh();
        },
      });
    } finally {
      setPromotingId(null);
    }
  };

  const remove = (pin: Idea) => {
    const previous = pins;
    setConfirmDelete(null);
    void run(() => deleteIdea(pin.id), {
      optimistic: () => setPins((list) => list.filter((p) => p.id !== pin.id)),
      rollback: () => setPins(previous),
      successMessage: t("inspiration.deleted"),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  if (pins.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb aria-hidden className="size-4" />}
        title={t("inspiration.noPins")}
        description={t("inspiration.noPinsHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === null} onClick={() => setFilter(null)}>
          {t("inspiration.allBoards")}
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
          title={t("inspiration.noMatches")}
          action={
            <Button size="sm" onClick={() => setFilter(null)}>
              {t("inspiration.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((pin) => (
            <li
              key={pin.id}
              className="rounded-xl border border-line bg-surface p-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/inspiration/pins/${pin.id}`}
                    className={cn(
                      "text-sm font-medium hover:underline",
                      pin.status === "dropped"
                        ? "text-faint line-through"
                        : "text-ink"
                    )}
                  >
                    {pin.title || t("inspiration.untitledPin")}
                  </Link>
                  {pin.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {pin.body}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-faint">
                    <span>{formatDate(pin.created_at, locale)}</span>
                    {pin.board_id && boardNames.has(pin.board_id) && (
                      <Link
                        href={`/inspiration/boards/${pin.board_id}`}
                        className="hover:underline"
                      >
                        {boardNames.get(pin.board_id)}
                      </Link>
                    )}
                    {pin.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-raised px-1.5 py-0.5 text-2xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {pin.collection_id && (
                      <Link
                        href={`/creative/collections/${pin.collection_id}`}
                        className="text-accent hover:underline"
                      >
                        {t("inspiration.madeInto")}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Promote only shows while it's still an idea — once made,
                      the link above takes you to what it became. */}
                  {!pin.collection_id && pin.status !== "dropped" && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void promote(pin)}
                      loading={promotingId === pin.id}
                      icon={
                        <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
                      }
                    >
                      {t("inspiration.makeIt")}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(pin)}
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
                    onClick={() => setStatus(pin, value)}
                    aria-pressed={pin.status === value}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-2xs transition-colors",
                      pin.status === value
                        ? "border-brand bg-brand-soft text-ink"
                        : "border-line text-muted hover:text-ink"
                    )}
                  >
                    {t(STATUS_KEY[value] as never)}
                  </button>
                ))}
                {pin.status === "made" && (
                  <Badge tone="accent">{t("inspiration.statusMade")}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("inspiration.deletePin")}
        body={t("inspiration.deletePinBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
