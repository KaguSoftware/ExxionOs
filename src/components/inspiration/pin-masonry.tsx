"use client";

import { Lightbulb, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { PinCard } from "@/components/inspiration/pin-card";
import { PinQuickLook } from "@/components/inspiration/pin-quick-look";
import {
  clearedFilters,
  useWallFilters,
} from "@/components/inspiration/use-wall-filters";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import {
  deleteIdea,
  setPinBoard,
  updateIdeaStatus,
} from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import {
  hasTag,
  imagesByIdea,
  liveBoards,
  matchesQuery,
  pinHaystack,
  tagsInUse,
} from "@/lib/inspiration";
import { createClient } from "@/lib/supabase/client";
import type { Board, Idea, IdeaImage, IdeaStatus } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/** Long enough for a browsing session; the wall is signed once per mount. */
const THUMB_TTL = 60 * 30;
/** A 5-column tile is ~350 CSS px, so ~700 device px at 2×. 480 was upscaled. */
const THUMB_SIZE = 640;

/**
 * The wall.
 *
 * ⚠️ CSS MULTI-COLUMN, NOT GRID MASONRY. Pins have unknown aspect ratios, and
 * text pins, link-only pins and failed decodes have none at all — a
 * `grid-auto-rows` masonry needs every tile's height in row units before it can
 * lay out, which for those means a JS measurement pass re-run on every filter
 * change and breakpoint. Columns needs none of it, and fills in the INLINE
 * direction, so Farsi flows right-to-left for free.
 *
 * Accepted cost: column-major reading order. That is how a pinboard reads.
 *
 * ⚠️ THIS COMPONENT OWNS THE VIEWER. Opening a pin used to be a route change,
 * which threw away the filters, the search, the scroll position and every
 * signed thumbnail. Rendering `PinQuickLook` here means the wall never
 * unmounts and all of that survives without anyone having to preserve it.
 */
export function PinMasonry({
  pins: initial,
  images,
  boards,
  /** Set on a board page — that board's filter is fixed and its row hidden. */
  lockedBoardId,
}: {
  pins: Idea[];
  images: IdeaImage[];
  boards: Board[];
  lockedBoardId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run } = useAction();

  const [filters, setFilters] = useWallFilters();
  const [pins, setPins] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null);
  /** `undefined` = still signing, `null` = signing failed, string = ready. */
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPins(initial);
  }

  const byIdea = useMemo(() => imagesByIdea(images), [images]);
  const boardNames = useMemo(
    () => new Map(boards.map((b) => [b.id, b.name] as const)),
    [boards]
  );
  const tags = useMemo(() => tagsInUse(pins), [pins]);
  const pickable = useMemo(() => liveBoards(boards), [boards]);

  /** Search haystacks, built once per data change rather than per keystroke. */
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const pin of pins) {
      map.set(
        pin.id,
        pinHaystack(pin, pin.board_id ? (boardNames.get(pin.board_id) ?? null) : null)
      );
    }
    return map;
  }, [pins, boardNames]);

  /** Everything except the dropped filter — lets the empty state tell the
   *  difference between "nothing matches" and "you're hiding it all". */
  const beforeDropped = useMemo(
    () =>
      pins.filter((pin) => {
        if (filters.board === "unsorted" && pin.board_id !== null) return false;
        if (
          filters.board &&
          filters.board !== "unsorted" &&
          pin.board_id !== filters.board
        ) {
          return false;
        }
        if (filters.tag && !hasTag(pin, filters.tag)) return false;
        if (!matchesQuery(haystacks.get(pin.id) ?? "", filters.q)) return false;
        return true;
      }),
    [pins, filters.board, filters.tag, filters.q, haystacks]
  );

  const visible = useMemo(
    () =>
      filters.dropped
        ? beforeDropped
        : // Dropped pins are hidden by default — you decided against them, and
          // they shouldn't take up wall space next to live ones.
          beforeDropped.filter((p) => p.status !== "dropped"),
    [beforeDropped, filters.dropped]
  );

  /**
   * Sign EVERY pin's first picture, once per mount.
   *
   * ⚠️ This used to depend on `visible` — a fresh array on every render — so
   * every chip click fired a whole new wave of storage calls. `byIdea` is
   * memoised from the stable server prop, so this runs once and filtering
   * costs nothing.
   */
  useEffect(() => {
    let cancelled = false;
    const first = [...byIdea.values()]
      .map((list) => list[0])
      .filter((image): image is IdeaImage => image !== undefined);
    if (first.length === 0) return;

    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        first.map(async (image) => {
          const { data } = await supabase.storage
            .from("creative")
            // ⚠️ The transform MUST go INTO createSignedUrl — appending
            // `&width=` to a signed URL silently returns the full-size image.
            .createSignedUrl(image.path, THUMB_TTL, {
              transform: {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                resize: "contain",
              },
            });
          // ⚠️ `null`, never `""`. An empty string is falsy, so a signing
          // failure rendered the skeleton FOREVER with no error and no retry.
          return [image.id, data?.signedUrl ?? null] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [byIdea]);

  const retryThumb = async (image: IdeaImage) => {
    setUrls((current) => {
      const next = { ...current };
      delete next[image.id];
      return next;
    });
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("creative")
      .createSignedUrl(image.path, THUMB_TTL, {
        transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: "contain" },
      });
    setUrls((current) => ({ ...current, [image.id]: data?.signedUrl ?? null }));
  };

  // --- mutations, all optimistic and none of them navigating ---------------

  const patch = (id: string, changes: Partial<Idea>) =>
    setPins((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const moveToBoard = (pin: Idea, boardId: string | null) => {
    const previous = pins;
    void run(() => setPinBoard(pin.id, boardId), {
      optimistic: () => patch(pin.id, { board_id: boardId }),
      rollback: () => setPins(previous),
      successMessage: t("inspiration.saved"),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  const setStatus = (pin: Idea, status: IdeaStatus) => {
    const previous = pins;
    void run(() => updateIdeaStatus(pin.id, status), {
      optimistic: () => patch(pin.id, { status }),
      rollback: () => setPins(previous),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  const remove = (pin: Idea) => {
    const previous = pins;
    setConfirmDelete(null);
    // Closing the viewer first, so the overlay can't be left pointing at a row
    // that no longer exists.
    if (filters.pin === pin.id) setFilters({ pin: null });
    void run(() => deleteIdea(pin.id), {
      optimistic: () => setPins((list) => list.filter((p) => p.id !== pin.id)),
      rollback: () => setPins(previous),
      successMessage: t("inspiration.deleted"),
      errorMessage: t("inspiration.deleteFailed"),
      onSuccess: () => router.refresh(),
    });
  };

  // --- empty states --------------------------------------------------------

  /** Something the user typed or clicked is narrowing the wall. */
  const narrowed =
    filters.board !== null || filters.tag !== null || filters.q.trim() !== "";
  /** The wall is empty ONLY because dropped pins are hidden. */
  const onlyDroppedLeft = !filters.dropped && beforeDropped.length > 0;

  if (pins.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb aria-hidden className="size-4" />}
        title={lockedBoardId ? t("inspiration.emptyBoard") : t("inspiration.noPins")}
        description={t("inspiration.noPinsHint")}
      />
    );
  }

  // The board row also carries "Unsorted", so it must survive a one-board
  // account — that is exactly the state a new user is in.
  const showBoardChips =
    !lockedBoardId && (pickable.length > 0 || pins.some((p) => !p.board_id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint"
          />
          <TextInput
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder={t("inspiration.searchPins")}
            aria-label={t("inspiration.searchPins")}
            className="ps-9 pe-9"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => setFilters({ q: "" })}
              aria-label={t("inspiration.clearFilters")}
              className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-faint hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>

        {/* Only offered once something has actually been dropped — a permanent
            control for a state you may never have used is chrome sitting on
            top of the pictures. Up here beside the search, not below a wall
            that can be several screens tall. */}
        {pins.some((p) => p.status === "dropped") && (
          <button
            type="button"
            onClick={() => setFilters({ dropped: !filters.dropped })}
            className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
          >
            {filters.dropped
              ? t("inspiration.hideDropped")
              : t("inspiration.showDropped")}
          </button>
        )}
      </div>

      {showBoardChips && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={filters.board === null}
            onClick={() => setFilters({ board: null })}
          >
            {t("inspiration.allBoards")}
          </FilterChip>
          {pickable.map((board) => (
            <FilterChip
              key={board.id}
              active={filters.board === board.id}
              onClick={() =>
                setFilters({
                  board: filters.board === board.id ? null : board.id,
                })
              }
            >
              {board.name}
            </FilterChip>
          ))}
          <FilterChip
            active={filters.board === "unsorted"}
            onClick={() =>
              setFilters({
                board: filters.board === "unsorted" ? null : "unsorted",
              })
            }
          >
            {t("inspiration.unsorted")}
          </FilterChip>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {/* An "All" reset, matching the board row above it. Without one the
              two chip rows behaved differently 20 pixels apart. */}
          <FilterChip
            active={filters.tag === null}
            onClick={() => setFilters({ tag: null })}
          >
            {t("inspiration.allTags")}
          </FilterChip>
          {tags.map(({ label, count }) => (
            <FilterChip
              key={label}
              active={filters.tag === label}
              onClick={() =>
                setFilters({ tag: filters.tag === label ? null : label })
              }
            >
              {label} · {count}
            </FilterChip>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={t("inspiration.noMatches")}
          action={
            // ⚠️ Two honest cases. The old code offered "Clear filters" based
            // on a flag that ignored the dropped toggle, so a board whose pins
            // were all dropped showed "nothing matches those filters" with no
            // control at all.
            narrowed ? (
              <Button size="sm" onClick={() => setFilters(clearedFilters())}>
                {t("inspiration.clearFilters")}
              </Button>
            ) : onlyDroppedLeft ? (
              <Button size="sm" onClick={() => setFilters({ dropped: true })}>
                {t("inspiration.showDropped")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        // ⚠️ NO `overflow-hidden` here — it disables column balancing in some
        // engines. The cards clip themselves.
        <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {visible.map((pin) => {
            const pictures = byIdea.get(pin.id) ?? [];
            const image = pictures[0];
            return (
              // `break-inside-avoid` is not optional: without it a card splits
              // across a column boundary, mid-picture.
              <li key={pin.id} className="mb-3 break-inside-avoid">
                <PinCard
                  pin={pin}
                  image={image}
                  imageCount={pictures.length}
                  thumbUrl={image ? urls[image.id] : undefined}
                  boardName={
                    pin.board_id && !lockedBoardId
                      ? (boardNames.get(pin.board_id) ?? null)
                      : null
                  }
                  boards={pickable}
                  onOpen={(id) => setFilters({ pin: id })}
                  onMoveToBoard={moveToBoard}
                  onDelete={setConfirmDelete}
                  onRetryThumb={(img) => void retryThumb(img)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <PinQuickLook
        pins={visible}
        allPins={pins}
        openId={filters.pin}
        onOpenChange={(id) => setFilters({ pin: id })}
        imagesByPin={byIdea}
        boards={boards}
        onMoveToBoard={moveToBoard}
        onSetStatus={setStatus}
        onDelete={setConfirmDelete}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("inspiration.deletePin")}
        body={t("inspiration.deletePinBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </div>
  );
}
