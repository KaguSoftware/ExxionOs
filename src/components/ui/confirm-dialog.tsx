"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * ⚠️ MODALS ARE FOR DESTRUCTIVE CONFIRMS ONLY.
 *
 * This is the only modal component in the app. An authoring surface goes in a
 * dedicated page or a full-screen `CreateOverlay`; a modal that holds a form is
 * a cramped page. The one thing a modal is genuinely right for is stopping the
 * user before something irreversible.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  // ⚠️ useId, NOT the literal "confirm-title" this used to hardcode. Several
  // ConfirmDialogs mount at once (every VocabularyManager and CreateForm
  // renders one), and duplicate ids make aria-labelledby resolve to whichever
  // heading is first in the document — announcing the wrong dialog's title.
  const titleId = useId();
  // Where focus goes when the dialog closes. Without this, cancelling a delete
  // drops focus to <body> and the keyboard user has to tab back through the
  // whole page to find the row they were on.
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Focus the CANCEL-adjacent safe path first? No — focus the confirm button
    // is wrong for a destructive action, and focusing nothing strands keyboard
    // users. The panel itself takes focus, so Escape and Tab both work and no
    // irreversible button is one Enter away.
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      // Focus trap: keep Tab inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: "var(--z-modal)" }}
    >
      {/* --scrim, not `bg-black/55`: a named CSS colour is theme-blind, and a
          55% black veil over a white page is heavier than the light theme
          wants. The token is tuned per theme in globals.css. */}
      <div
        className="animate-fade-in absolute inset-0 backdrop-blur-[2px]"
        style={{ backgroundColor: "var(--scrim)" }}
        onClick={onCancel}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "animate-pop-in relative w-full max-w-sm rounded-xl border border-line",
          "bg-raised p-5 shadow-[var(--shadow-3)] focus:outline-none"
        )}
      >
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
