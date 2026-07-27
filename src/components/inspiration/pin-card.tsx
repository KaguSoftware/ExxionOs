"use client";

import { FolderInput, ImageOff, Images, Link2, Trash2 } from "lucide-react";
import Link from "next/link";

import { Menu, type MenuItem } from "@/components/ui/menu";
import { useI18n } from "@/lib/i18n/client";
import { pinAspect, sourceLabel } from "@/lib/inspiration";
import type { Board, Idea, IdeaImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One tile on the wall.
 *
 * ⚠️ AN `<article>` WITH A STRETCHED ANCHOR, not one big `<Link>`. The tile was
 * a single anchor wrapping everything, which structurally forbids a button
 * inside it — nested interactive elements are invalid HTML with unreliable hit
 * targets, and that is why the wall had no actions at all. The anchor is now an
 * absolutely-positioned overlay sibling; the action buttons sit above it.
 *
 * ⚠️ IT IS STILL A REAL ANCHOR, deliberately. A plain left-click is intercepted
 * and opens the quick-look (no navigation, so the wall keeps its filters and
 * scroll), but ctrl/cmd/middle-click still opens the full pin page in a new
 * tab, the browser still shows the URL on hover, and a screen reader still
 * announces a link to a real destination.
 *
 * ⚠️ TOUCH HAS NO HOVER, AND THAT IS CORRECT. Do not "fix" this by forcing the
 * action pills visible on small screens — a tap opens the quick-look, which
 * holds a strict superset of them. Pinning them open rebuilds the dossier tile
 * this rework exists to remove.
 */
export function PinCard({
  pin,
  image,
  imageCount,
  /** Signed at the wall level. `undefined` = still signing, `null` = failed. */
  thumbUrl,
  boardName,
  boards,
  onOpen,
  onMoveToBoard,
  onDelete,
  onRetryThumb,
}: {
  pin: Idea;
  image: IdeaImage | undefined;
  imageCount: number;
  thumbUrl: string | null | undefined;
  boardName: string | null;
  boards: Board[];
  onOpen: (id: string) => void;
  onMoveToBoard: (pin: Idea, boardId: string | null) => void;
  onDelete: (pin: Idea) => void;
  onRetryThumb: (image: IdeaImage) => void;
}) {
  const { t } = useI18n();
  const aspect = pinAspect(image);
  const source = sourceLabel(pin.source_url);
  const dropped = pin.status === "dropped";
  const title = pin.title || t("inspiration.untitledPin");

  const boardItems: MenuItem[] = [
    {
      id: "unsorted",
      label: t("inspiration.unsorted"),
      disabled: pin.board_id === null,
      onSelect: () => onMoveToBoard(pin, null),
    },
    ...boards.map((board) => ({
      id: board.id,
      label: board.name,
      disabled: pin.board_id === board.id,
      onSelect: () => onMoveToBoard(pin, board.id),
    })),
  ];

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-line bg-surface",
        "transition-colors duration-[var(--dur-fast)] hover:border-line-strong",
        "focus-within:border-line-strong",
        // A pin you decided against stays legible but stops competing.
        dropped && "opacity-60"
      )}
    >
      {image ? (
        // ⚠️ The ratio is ALWAYS set, falling back to 4:5 when unknown. An
        // unset height would let the picture size the box — precisely the
        // reflow the stored dimensions exist to prevent.
        <div
          className="relative bg-raised"
          style={{ aspectRatio: aspect ?? 4 / 5 }}
        >
          {thumbUrl === undefined && <div className="skeleton size-full" />}
          {thumbUrl === null && (
            // ⚠️ A signing failure used to store "" and render the skeleton
            // FOREVER — indistinguishable from a slow network, with no way out.
            <div className="flex size-full flex-col items-center justify-center gap-2 text-faint">
              <ImageOff aria-hidden className="size-5" />
              <button
                type="button"
                onClick={() => onRetryThumb(image)}
                className="relative z-20 text-xs underline hover:text-ink"
              >
                {t("common.retry")}
              </button>
            </div>
          )}
          {thumbUrl && (
            /* A plain <img>: short-lived signed URLs from a private bucket.
               next/image would cache a copy that outlives the token and 400. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbUrl}
              alt={title}
              className="animate-fade-in size-full object-cover"
              loading="lazy"
            />
          )}

          {/* Board + tags, revealed with the actions rather than printed under
              every picture. Inside the media box so the gradient sits on the
              photograph, and `pointer-events-none` so it never eats a click
              meant for the stretched anchor beneath it. */}
          {(boardName || pin.tags.length > 0) && (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-1 p-2",
                "bg-gradient-to-t from-black/70 to-transparent",
                "opacity-0 transition-opacity duration-[var(--dur-fast)]",
                "group-hover:opacity-100 group-focus-within:opacity-100"
              )}
            >
              {boardName && (
                <span className="rounded bg-black/50 px-1.5 py-0.5 text-2xs text-white">
                  {boardName}
                </span>
              )}
              {pin.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-black/50 px-1.5 py-0.5 text-2xs text-white/85"
                >
                  {tag}
                </span>
              ))}
              {pin.tags.length > 3 && (
                <span className="text-2xs text-white/70">
                  +{pin.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        pin.body && (
          // A text pin still needs presence on a wall of pictures, so the body
          // becomes the tile rather than a footnote under an empty box.
          <p className="line-clamp-6 bg-raised p-4 text-sm leading-relaxed text-ink">
            {pin.body}
          </p>
        )
      )}

      <div className="flex flex-col gap-1.5 p-3">
        {/* Title ONLY. Board and tags moved into the hover scrim below, and
            the status badge is gone entirely — a wall at rest should read as
            pictures, not as a row of dossiers. */}
        {(pin.title || (!image && !pin.body)) && (
          <p
            className={cn(
              "line-clamp-1 text-sm font-medium",
              pin.title ? "text-ink" : "text-faint italic",
              dropped && "line-through"
            )}
          >
            {title}
          </p>
        )}

        {/* The source chip STAYS PERMANENT on a link-only pin — it is the only
            thing distinguishing "this site refused its picture" from "this
            picture failed to load". */}
        {!image && source && (
          <span className="flex items-center gap-1 text-xs text-faint" dir="ltr">
            <Link2 aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{source}</span>
          </span>
        )}
      </div>

      {/* ⚠️ THE PRIMARY ACTION, stretched over the whole tile and UNDER the
          action buttons (z-10 vs z-20). Keeping it an anchor is what preserves
          ctrl-click, middle-click and "copy link address". */}
      <Link
        href={`/inspiration/pins/${pin.id}`}
        onClick={(e) => {
          // Let the browser handle every modified click natively.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onOpen(pin.id);
        }}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="sr-only">{title}</span>
      </Link>

      {/* Multi-image count — ALWAYS visible. A pin holding nine pictures used
          to be pixel-identical to one holding a single picture. */}
      {imageCount > 1 && (
        <span className="pointer-events-none absolute start-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-2xs font-medium text-white">
          <Images aria-hidden className="size-3" />
          {imageCount}
        </span>
      )}

      {/* Two actions, no more. A third turns the wall back into a control
          panel; everything else lives one tap away in the quick-look. */}
      <div
        className={cn(
          "absolute end-2 top-2 z-20 flex items-center gap-1",
          "opacity-0 transition-opacity duration-[var(--dur-fast)]",
          "group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        <Menu
          label={t("inspiration.moveToBoard")}
          items={boardItems}
          trigger={<FolderInput aria-hidden className="size-3.5" />}
          className="size-7 rounded-full border-transparent bg-black/60 text-white hover:border-transparent hover:bg-black/75 hover:text-white"
        />
        <button
          type="button"
          onClick={() => onDelete(pin)}
          aria-label={t("common.delete")}
          className="grid size-7 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-danger-fill"
        >
          <Trash2 aria-hidden className="size-3.5" />
        </button>
      </div>

    </article>
  );
}
