"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Lightbox } from "@/components/creative/lightbox";
import { PinStatusControl } from "@/components/inspiration/pin-status";
import { SignedImage } from "@/components/inspiration/signed-image";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { LinksList } from "@/components/ui/links-list";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards, sourceLabel } from "@/lib/inspiration";
import type { Board, Idea, IdeaImage, IdeaStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * A pin, opened OVER the wall.
 *
 * ⚠️ WHY THIS EXISTS AT ALL. Opening a pin used to be a route change, and the
 * wall's filters, search, scroll position and signed thumbnails were all
 * component state — so looking at one picture threw away everything about how
 * you were browsing. Rendering the viewer inside the masonry means the wall
 * never unmounts, and all of that survives BY CONSTRUCTION rather than by
 * anyone remembering to preserve it.
 *
 * ⚠️ THIS IS A VIEWER, NOT AN AUTHORING FORM. The standing rule is that modals
 * are for destructive confirms and `CreateOverlay` is the authoring surface;
 * this is neither. It shows a picture and offers the same one-click state
 * changes a list row would (board, status) — writing title/notes/links still
 * belongs to `PinComposer`, one click away via "Open pin".
 *
 * ⚠️ `Lightbox` IS NOT SUPERSEDED — it nests one level deeper. Clicking the big
 * picture opens the untransformed original at `--z-modal` (70), above this
 * surface at `--z-overlay` (60).
 */
export function PinQuickLook({
  pins,
  allPins,
  openId,
  onOpenChange,
  imagesByPin,
  boards,
  onMoveToBoard,
  onSetStatus,
  onDelete,
}: {
  /** The FILTERED wall, in order — so prev/next walk what the user sees. */
  pins: Idea[];
  /**
   * ⚠️ EVERY pin, used only to resolve the OPEN one. Marking a pin "dropped"
   * from in here removes it from the filtered list, and resolving against that
   * list alone would slam the viewer shut the instant you pressed the button.
   */
  allPins: Idea[];
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  imagesByPin: Map<string, IdeaImage[]>;
  boards: Board[];
  onMoveToBoard: (pin: Idea, boardId: string | null) => void;
  onSetStatus: (pin: Idea, status: IdeaStatus) => void;
  onDelete: (pin: Idea) => void;
}) {
  const { t, locale } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  const [pictureIndex, setPictureIndex] = useState(0);
  const [zoomed, setZoomed] = useState<IdeaImage | null>(null);

  /** Position within the filtered wall — -1 once this pin no longer matches. */
  const index = pins.findIndex((p) => p.id === openId);
  const pin = allPins.find((p) => p.id === openId) ?? null;
  const open = pin !== null;
  const pictures = pin ? (imagesByPin.get(pin.id) ?? []) : [];
  const picture = pictures[pictureIndex] ?? pictures[0];

  /**
   * ⚠️ EVERY CALLBACK AND THE CURRENT POSITION IN ONE REF, synced by a
   * dep-less effect. The key handler below must not list any of them, or it
   * would re-bind on every parent render.
   */
  const latest = useRef({ pins, index, onOpenChange, open });
  useEffect(() => {
    latest.current = { pins, index, onOpenChange, open };
  });

  /** Changing pin resets the picture index HERE, in the handler — never in an
   *  effect, which would commit the stale index for one frame. */
  const go = (delta: number) => {
    const { pins: list, index: at } = latest.current;
    const next = at + delta;
    if (next < 0 || next >= list.length) return;
    setPictureIndex(0);
    latest.current.onOpenChange(list[next].id);
  };

  const close = () => {
    setZoomed(null);
    setPictureIndex(0);
    latest.current.onOpenChange(null);
  };

  // Body scroll lock, WITH the padding compensation — without it the wall
  // jumps ~15px sideways every time this opens.
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingInlineEnd;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingInlineEnd = prevPadding;
    };
  }, [open]);

  /**
   * ⚠️ `[open]` ONLY — NOT `[openId]`, and not any callback.
   *
   * Keying this on the pin id would re-run it on every arrow press, and the
   * body calls `panelRef.focus()` — so arrowing to the next pin while typing in
   * the tag field would yank focus out after one character. That is exactly the
   * 2026-07-23 focus-steal bug, reachable by a different route. Everything the
   * handler needs lives in `latest` above.
   */
  useEffect(() => {
    if (!open) return;

    const restore = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape closes the Lightbox first if it's up, then this.
        e.preventDefault();
        latest.current.onOpenChange(null);
        return;
      }

      // Arrow keys are for the wall, not for a caret. Bail whenever focus is
      // in a field — the same guard the capture listeners use.
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        // Direction follows the DOCUMENT, not the key name — in Farsi the
        // right arrow means "the previous one" visually.
        const rtl = document.documentElement.dir === "rtl";
        const forward = (e.key === "ArrowRight") !== rtl;
        go(forward ? 1 : -1);
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restore?.focus();
    };
  }, [open]);

  if (!pin || typeof document === "undefined") return null;

  const source = sourceLabel(pin.source_url);
  const title = pin.title || t("inspiration.untitledPin");

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("inspiration.quickLook")}
        style={{ zIndex: "var(--z-overlay)" }}
        className="animate-fade-in fixed inset-0 grid place-items-center p-4"
        onClick={close}
      >
        {/* The scrim is the whole point: the wall stays visible behind it, so
            Escape obviously returns you to where you were. */}
        <div
          aria-hidden
          style={{ backgroundColor: "var(--scrim)" }}
          className="absolute inset-0"
        />

        <div
          ref={panelRef}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "animate-pop-in relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden",
            "rounded-xl border border-line bg-surface shadow-lg outline-none",
            "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
          )}
        >
          {/* --- media ------------------------------------------------- */}
          {picture ? (
            <div className="relative flex min-h-0 flex-col bg-raised">
              <button
                type="button"
                onClick={() => setZoomed(picture)}
                aria-label={t("creative.viewPhoto")}
                className="grid min-h-0 flex-1 place-items-center p-2"
              >
                <SignedImage
                  key={picture.id}
                  path={picture.path}
                  size={1600}
                  alt={title}
                  className="max-h-[70dvh] w-auto max-w-full object-contain"
                  fallbackClassName="aspect-[4/5] max-h-[70dvh]"
                />
              </button>

              {pictures.length > 1 && (
                <>
                  <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-2xs font-medium text-white">
                    {t("inspiration.pictureCount", {
                      index: pictureIndex + 1,
                      total: pictures.length,
                    })}
                  </span>
                  <div className="flex shrink-0 gap-1.5 overflow-x-auto p-2">
                    {pictures.map((item, i) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPictureIndex(i)}
                        aria-pressed={i === pictureIndex}
                        className={cn(
                          "size-12 shrink-0 overflow-hidden rounded border",
                          i === pictureIndex ? "border-brand" : "border-line"
                        )}
                      >
                        <SignedImage
                          path={item.path}
                          size={128}
                          alt=""
                          className="size-full object-cover"
                          fallbackClassName="size-full"
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            // A text or link-only pin has no media column; the body carries it.
            pin.body && (
              <div className="max-h-[40dvh] overflow-y-auto bg-raised p-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {pin.body}
                </p>
              </div>
            )
          )}

          {/* --- details ----------------------------------------------- */}
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
            <div className="pe-8">
              <h2 className="font-display text-lg text-ink">{title}</h2>
              <p className="mt-0.5 text-xs text-faint">
                {formatDate(pin.created_at, locale)}
              </p>
            </div>

            {/* ⚠️ The board picker sits HIGH on purpose. `Dropdown` does not
                portal, so its list opens inside this scrolling column — near
                the bottom it would have nowhere to go. */}
            {/* A div, not a label — `Dropdown` renders a button, and a label
                wrapping a non-labelable control is invalid. `Dropdown` takes
                its own accessible name via `label`. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">
                {t("inspiration.board")}
              </span>
              <Dropdown
                value={pin.board_id ?? ""}
                onChange={(value) => onMoveToBoard(pin, value || null)}
                label={t("inspiration.moveToBoard")}
                placeholder={t("inspiration.unsorted")}
                options={[
                  { value: "", label: t("inspiration.unsorted") },
                  ...liveBoards(boards).map((b) => ({
                    value: b.id,
                    label: b.name,
                  })),
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">
                {t("inspiration.status")}
              </span>
              <PinStatusControl
                status={pin.status}
                onChange={(status) => onSetStatus(pin, status)}
              />
            </div>

            {picture && pin.body && (
              <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {pin.body}
              </p>
            )}

            {pin.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-raised px-2 py-0.5 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {(pin.source_url || pin.links.length > 0) && (
              <div className="flex flex-col gap-2">
                {pin.source_url && (
                  <a
                    href={pin.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand-text hover:underline"
                  >
                    <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                    <span dir="ltr" className="truncate">
                      {source ?? t("inspiration.openSource")}
                    </span>
                  </a>
                )}
                <LinksList links={pin.links} />
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
              <Link href={`/inspiration/pins/${pin.id}`}>
                <Button variant="secondary" size="sm">
                  {t("inspiration.openPin")}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(pin)}
                aria-label={t("common.delete")}
                icon={<Trash2 aria-hidden className="size-4" />}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="absolute end-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-surface/80 text-muted transition-colors hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {/* Prev / next walk the FILTERED wall — arrowing past something you
            filtered out would be a lie about what you're looking at. Both hide
            when this pin has dropped out of the filter (index -1), because
            "next" from nowhere has no meaning. */}
        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label={t("inspiration.previousPin")}
            className="absolute start-2 top-1/2 grid size-10 place-items-center rounded-full bg-surface/90 text-ink shadow-lg transition-colors hover:bg-surface"
          >
            <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
          </button>
        )}
        {index >= 0 && index < pins.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label={t("inspiration.nextPin")}
            className="absolute end-2 top-1/2 grid size-10 place-items-center rounded-full bg-surface/90 text-ink shadow-lg transition-colors hover:bg-surface"
          >
            <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
          </button>
        )}
      </div>

      {zoomed && (
        <Lightbox
          bucket="creative"
          path={zoomed.path}
          alt={title}
          onClose={() => setZoomed(null)}
        />
      )}
    </>,
    document.body
  );
}
