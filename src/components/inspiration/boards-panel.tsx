"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { boardPinCounts, imagesByIdea } from "@/lib/inspiration";
import { createClient } from "@/lib/supabase/client";
import type { Board, Idea, IdeaImage } from "@/lib/types";
import { cn } from "@/lib/utils";

const THUMB_TTL = 60 * 30;

/**
 * The folders.
 *
 * ⚠️ A BOARD WITH NO COVER DRAWS A MOSAIC of its own newest pins rather than an
 * empty grey square. Board covers are set by hand ("use as cover" on a pin), so
 * most boards will never have one — and a wall of blank tiles would make the
 * tab look broken rather than new.
 */
export function BoardsPanel({
  boards,
  pins,
  images,
}: {
  boards: Board[];
  pins: Idea[];
  images: IdeaImage[];
}) {
  const { t } = useI18n();
  const [showArchived, setShowArchived] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const counts = useMemo(() => boardPinCounts(pins), [pins]);
  const byIdea = useMemo(() => imagesByIdea(images), [images]);

  /** Cover path, else up to four pictures from the board's newest pins. */
  const tiles = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const board of boards) {
      if (board.cover_path) {
        map.set(board.id, [board.cover_path]);
        continue;
      }
      const paths: string[] = [];
      for (const pin of pins) {
        if (pin.board_id !== board.id) continue;
        const image = byIdea.get(pin.id)?.[0];
        if (image) paths.push(image.path);
        if (paths.length === 4) break;
      }
      map.set(board.id, paths);
    }
    return map;
  }, [boards, pins, byIdea]);

  const visible = showArchived
    ? boards
    : boards.filter((b) => b.archived_at === null);

  useEffect(() => {
    let cancelled = false;
    const paths = [...new Set([...tiles.values()].flat())];
    if (paths.length === 0) return;

    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage
            .from("creative")
            // Transform INTO createSignedUrl — appending `&width=` to a signed
            // URL silently returns the full-size original.
            .createSignedUrl(path, THUMB_TTL, {
              transform: { width: 320, height: 320, resize: "cover" },
            });
          return [path, data?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [tiles]);

  if (boards.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid aria-hidden className="size-4" />}
        title={t("inspiration.noBoards")}
        description={t("inspiration.noBoardsHint")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {boards.some((b) => b.archived_at !== null) && (
        <Checkbox
          className="w-fit"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          label={t("inspiration.showArchivedBoards")}
        />
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((board) => {
          const paths = tiles.get(board.id) ?? [];
          const count = counts.get(board.id) ?? 0;

          return (
            <li key={board.id}>
              <Link
                href={`/inspiration/boards/${board.id}`}
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface",
                  "transition-colors hover:border-line-strong",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  board.archived_at && "opacity-60"
                )}
              >
                <div
                  className={cn(
                    "aspect-square bg-raised",
                    // One picture fills the tile; several make a 2×2 mosaic.
                    paths.length > 1 && "grid grid-cols-2 gap-px"
                  )}
                >
                  {paths.length === 0 ? (
                    <div className="grid size-full place-items-center text-faint">
                      <LayoutGrid aria-hidden className="size-6" />
                    </div>
                  ) : (
                    paths.map((path) =>
                      urls[path] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={path}
                          src={urls[path]}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div key={path} className="skeleton size-full" />
                      )
                    )
                  )}
                </div>

                <div className="flex flex-col gap-1 p-3">
                  <p className="text-sm font-medium text-ink">{board.name}</p>
                  {board.description && (
                    <p className="line-clamp-2 text-xs text-muted">
                      {board.description}
                    </p>
                  )}
                  <span className="text-xs text-faint">
                    {count === 1
                      ? t("inspiration.pinCountOne")
                      : t("inspiration.pinCount", { count })}
                  </span>
                  {board.archived_at && (
                    <Badge tone="neutral">{t("inspiration.archivedBoard")}</Badge>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
