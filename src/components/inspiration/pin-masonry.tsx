"use client";

import { Lightbulb } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FilterChip } from "@/components/creative/collections-panel";
import { PinCard } from "@/components/inspiration/pin-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { hasTag, imagesByIdea, tagsInUse } from "@/lib/inspiration";
import { createClient } from "@/lib/supabase/client";
import type { Board, Idea, IdeaImage } from "@/lib/types";

/** Long enough for a browsing session; the wall is signed once per mount. */
const THUMB_TTL = 60 * 30;
/** Big enough for a 5-column desktop tile on a retina screen, small enough
 *  that forty of them aren't forty megabytes. */
const THUMB_SIZE = 480;

/**
 * The board itself.
 *
 * ⚠️ CSS MULTI-COLUMN, NOT GRID MASONRY. Pins have unknown aspect ratios — and
 * text pins, link-only pins and any failed decode have NO ratio at all. A
 * `grid-auto-rows` masonry needs every tile's height in row units before it can
 * lay out, which for those means a JS measurement pass re-run on every filter
 * change and every breakpoint. `columns-*` needs none of that: a card is a
 * normal block and the browser flows it.
 *
 * It also fills in the INLINE direction, so a Farsi layout fills right-to-left
 * for free, and every class here (`columns-*`, `gap-*`, `mb-*`,
 * `break-inside-avoid`) is direction-neutral.
 *
 * Accepted cost: reading order is column-major — down column one, then column
 * two. That is how Pinterest reads and is right for browsing. It would be
 * WRONG for the text lens, which is why the List tab stays a flat column.
 */
export function PinMasonry({
  pins,
  images,
  boards,
  /** When set, the board page is showing one board and its filter is fixed. */
  lockedBoardId,
}: {
  pins: Idea[];
  images: IdeaImage[];
  boards: Board[];
  lockedBoardId?: string;
}) {
  const { t } = useI18n();

  const [boardFilter, setBoardFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const byIdea = useMemo(() => imagesByIdea(images), [images]);
  const boardNames = useMemo(
    () => new Map(boards.map((b) => [b.id, b.name] as const)),
    [boards]
  );
  const tags = useMemo(() => tagsInUse(pins), [pins]);

  const visible = useMemo(() => {
    return pins.filter((pin) => {
      // Dropped pins are hidden unless asked for — you decided against them,
      // and they shouldn't take up wall space next to live ones.
      if (!showDropped && pin.status === "dropped") return false;
      if (boardFilter === "unsorted" && pin.board_id !== null) return false;
      if (
        boardFilter &&
        boardFilter !== "unsorted" &&
        pin.board_id !== boardFilter
      ) {
        return false;
      }
      if (tagFilter && !hasTag(pin, tagFilter)) return false;
      return true;
    });
  }, [pins, boardFilter, tagFilter, showDropped]);

  // Sign the visible thumbnails. A genuine external subscription (network), so
  // an effect is correct here — unlike a state mirror, which is banned.
  useEffect(() => {
    let cancelled = false;
    const paths = visible
      .map((pin) => byIdea.get(pin.id)?.[0])
      .filter((image): image is IdeaImage => image !== undefined);
    if (paths.length === 0) return;

    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        paths.map(async (image) => {
          const { data } = await supabase.storage
            .from("creative")
            // ⚠️ The transform MUST go INTO createSignedUrl. Appending
            // `&width=` to an already-signed URL silently returns the
            // full-size image — the transform is baked into the token.
            .createSignedUrl(image.path, THUMB_TTL, {
              transform: {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                resize: "contain",
              },
            });
          return [image.id, data?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) {
        // Merged, not replaced: filtering to a subset and back must not
        // re-sign pictures we already hold a live URL for.
        setUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, byIdea]);

  const filtered = boardFilter !== null || tagFilter !== null;

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
    <div className="flex flex-col gap-4">
      {/* Filters. The board row is hidden on a board page — you are already
          inside one, and offering to filter to a different board there would
          contradict the page you're on. */}
      {!lockedBoardId && boards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={boardFilter === null} onClick={() => setBoardFilter(null)}>
            {t("inspiration.allBoards")}
          </FilterChip>
          {boards.map((board) => (
            <FilterChip
              key={board.id}
              active={boardFilter === board.id}
              onClick={() =>
                setBoardFilter(boardFilter === board.id ? null : board.id)
              }
            >
              {board.name}
            </FilterChip>
          ))}
          <FilterChip
            active={boardFilter === "unsorted"}
            onClick={() =>
              setBoardFilter(boardFilter === "unsorted" ? null : "unsorted")
            }
          >
            {t("inspiration.unsorted")}
          </FilterChip>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(({ label, count }) => (
            <FilterChip
              key={label}
              active={tagFilter === label}
              onClick={() => setTagFilter(tagFilter === label ? null : label)}
            >
              {label} · {count}
            </FilterChip>
          ))}
        </div>
      )}

      <Checkbox
        className="w-fit"
        checked={showDropped}
        onChange={(e) => setShowDropped(e.target.checked)}
        label={t("inspiration.showDropped")}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("inspiration.noMatches")}
          action={
            filtered ? (
              <Button
                size="sm"
                onClick={() => {
                  setBoardFilter(null);
                  setTagFilter(null);
                }}
              >
                {t("inspiration.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        // ⚠️ NO `overflow-hidden` on this list — it disables column balancing
        // in some engines, and the cards already round themselves.
        <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {visible.map((pin) => {
            const image = byIdea.get(pin.id)?.[0];
            return (
              // `break-inside-avoid` is not optional: without it a card splits
              // across a column boundary, mid-picture.
              <li key={pin.id} className="mb-3 break-inside-avoid">
                <PinCard
                  pin={pin}
                  image={image}
                  thumbUrl={image ? urls[image.id] : undefined}
                  boardName={
                    pin.board_id && !lockedBoardId
                      ? (boardNames.get(pin.board_id) ?? null)
                      : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
