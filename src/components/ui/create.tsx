"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TranslateKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * ⚠️ EVERY "add new X" IN THIS APP IS A DEDICATED SPACIOUS SURFACE — a
 * `/…/new` page or a full-screen overlay. Never an inline expander that grows
 * out of a list, and never a modal: authoring needs room, and a form that
 * appears inside a row pushes everything below it around while you type.
 *
 * ⚠️ NO REQUIRED FIELDS. Submitting with something empty is allowed; the form
 * asks once ("Title is empty — create it anyway?") and then does it. A blocking
 * validator that refuses to submit is how someone loses a half-written note.
 */

export function CreatePage({
  title,
  titleKey,
  description,
  descriptionKey,
  children,
  wide = false,
}: {
  title?: ReactNode;
  /**
   * ⚠️ PREFER THIS OVER `title` — pass the KEY, not the translated string.
   *
   * These pages are server components, so a `title={t("…")}` resolved up there
   * is frozen in whatever language the request was made in. The language
   * switch is now instant and client-side (see `I18nProvider`), which means a
   * server-translated title would be the ONE string left in the old language,
   * sitting at the top of the page in the largest type on screen. Passing the
   * key lets this client component translate it live.
   */
  titleKey?: TranslateKey;
  description?: ReactNode;
  descriptionKey?: TranslateKey;
  children: ReactNode;
  /** For composer-type surfaces that need more than a single column. */
  wide?: boolean;
}) {
  const router = useRouter();
  const t = useT();

  const heading = titleKey ? t(titleKey) : title;
  const sub = descriptionKey ? t(descriptionKey) : description;

  return (
    <div className="animate-fade-rise mx-auto w-full px-4 py-6 md:px-8">
      <div className={cn("mx-auto w-full", wide ? "max-w-3xl" : "max-w-xl")}>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("common.back")}
        </button>

        <h1 className="font-display text-2xl text-ink">{heading}</h1>
        {sub && <p className="mt-1 max-w-[65ch] text-sm text-muted">{sub}</p>}

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * The form body + submit row, with the empty-field confirm built in.
 *
 * `emptyFields` is the list of human-readable names that are currently blank.
 * The caller computes it; this component decides whether to ask.
 */
export function CreateForm({
  onSubmit,
  emptyFields,
  submitLabel,
  pending,
  children,
  onCancel,
}: {
  onSubmit: () => void | Promise<void>;
  emptyFields: string[];
  submitLabel?: string;
  pending?: boolean;
  children: ReactNode;
  onCancel?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (emptyFields.length > 0) {
      setConfirming(true);
      return;
    }
    void onSubmit();
  };

  const fieldList = emptyFields.join(", ");

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {children}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={onCancel ?? (() => router.back())}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          {/* ⚠️ The submit button never swaps variant or label width while
              pending — an outline button has a 1px border and a filled one
              doesn't, so switching between them shifts every neighbour by 2px.
              `loading` swaps the ICON only. */}
          <Button type="submit" variant="primary" loading={pending}>
            {submitLabel ?? t("common.create")}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        destructive={false}
        title={
          emptyFields.length === 1
            ? t("create.emptyConfirmOne", { fields: fieldList })
            : t("create.emptyConfirmTitle", { fields: fieldList })
        }
        body={t("create.emptyConfirmBody")}
        confirmLabel={t("common.create")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void onSubmit();
        }}
      />
    </>
  );
}

/**
 * Full-screen authoring overlay — the same spaciousness as CreatePage for
 * surfaces that shouldn't cost a navigation (editing something in place).
 */
export function CreateOverlay({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * ⚠️ `onClose` in a REF, so the focus/Escape effect below can call the latest
   * one WITHOUT depending on it.
   *
   * Callers pass `onClose` inline (`onClose={() => setOpen(false)}`), so it is a
   * new function every render. When that effect listed `onClose` in its deps, a
   * single keystroke in any field re-rendered the parent, gave a fresh
   * `onClose`, and re-ran the effect — whose cleanup + body call
   * `panelRef.current?.focus()`, yanking focus off the input after ONE
   * character. That was the "typing un-focuses the field" bug, and it hit every
   * overlay form (print run, idea edit, …) while `/…/new` PAGE forms — which
   * have no such effect — were fine. The ref keeps the handler current with the
   * effect keyed on `open` alone, so it runs once per open, not per keystroke.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /**
   * ⚠️ LOCK THE PAGE BEHIND THE OVERLAY.
   *
   * The overlay is `fixed inset-0 overflow-y-auto`, so it covers the viewport
   * — but the document underneath kept its own scrollbar. That produced the
   * reported bug exactly: a short form (the print-run dialog) showing a
   * full-height page scrollbar with a tiny thumb, and a wheel gesture near the
   * edge scrolling the page instead of the dialog.
   *
   * The padding compensation matters as much as the lock: removing a classic
   * scrollbar without replacing its width makes the whole page jump sideways
   * by ~15px the moment the dialog opens. Overlay-style scrollbars report 0,
   * so this is a no-op there.
   */
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

  // Escape closes, matching ConfirmDialog and the popovers. Without it the
  // only way out of a full-screen surface is finding the back button.
  //
  // ⚠️ This effect also owns FOCUS, and it must. `aria-modal="true"` below
  // tells assistive tech the rest of the page does not exist — but focus was
  // left on the trigger button OUT THERE, so a screen-reader user landed in a
  // region that had just been declared hidden, and Tab walked straight out of
  // the overlay into the page behind. ConfirmDialog has done all of this since
  // it was written; this component, the bigger surface, had none of it.
  useEffect(() => {
    if (!open) return;

    const restore = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    // ⚠️ `open` ONLY. Adding `onClose` re-runs this on every keystroke (it's a
    // fresh inline function each render) and steals focus — see the ref above.
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  /**
   * ⚠️ PORTALLED TO `document.body`, AND THAT IS THE WHOLE FIX.
   *
   * `position: fixed` resolves against the viewport ONLY when no ancestor has
   * a transform, filter or perspective. Every page that opens this overlay
   * wraps its content in `animate-fade-rise`, which animates `transform` — so
   * while that animation is running the wrapper IS the containing block, and
   * `inset-0` resolved against a box the height of the page content instead of
   * the screen. That is the "form cuts off halfway down" report: a short
   * client page gave a short wrapper, so the overlay was short.
   *
   * Ending the keyframe at `transform: none` (see globals.css) is necessary
   * but NOT sufficient — it only clears the transform on the FINAL frame, and
   * the overlay can be opened while the animation is still running. Escaping
   * the subtree entirely is the only version that cannot regress.
   *
   * `ConfirmDialog` and the toast layer already portal for exactly this
   * reason; this component was the one that did not.
   */
  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      className="animate-fade-in fixed inset-0 overflow-y-auto bg-bg focus:outline-none"
      style={{ zIndex: "var(--z-overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* ⚠️ `min-h-full` + `flex` + `my-auto`, all three. The scroll container
          is the fixed parent, so without `min-h-full` this box is only as tall
          as the form and a SHORT form sits jammed under the top edge. With it,
          a short form centres and a TALL form still scrolls normally — the
          padding stays outside the centring, so nothing is ever clipped. */}
      <div className="flex min-h-full flex-col">
        <div className="mx-auto my-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
          <button
            type="button"
            onClick={onClose}
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t("common.back")}
          </button>
          <h1 id={titleId} className="font-display text-2xl text-ink">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
