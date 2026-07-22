"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  /**
   * ⚠️ MAY RETURN A PROMISE, AND SHOULD when the action is a server round-trip.
   *
   * If `onConfirm` returns a promise, the dialog stays open and its confirm
   * button spins until the promise settles, THEN closes itself. This is the fix
   * for a whole class of call sites that passed `loading={pending}` but then
   * closed the dialog synchronously inside `onConfirm` — the dialog unmounted
   * before `pending` ever flipped, so the spinner was dead code and a slow
   * delete gave no feedback at all. Returning the promise here means the caller
   * no longer manages the dialog's open state on the success path or passes
   * `loading` by hand; both are handled internally. A void return keeps the old
   * fire-and-close behaviour.
   */
  onConfirm: () => unknown;
  onCancel: () => void;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  // In-flight state OWNED by the dialog, for the async-onConfirm contract.
  const [busy, setBusy] = useState(false);
  // Ref mirror so the keydown effect (which doesn't depend on `busy`) reads the
  // live value rather than the value captured when the listener was attached.
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
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
        // Don't let Escape cancel while the action is mid-flight — the write is
        // already happening, and closing now would just hide its outcome.
        if (!busyRef.current) onCancel();
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

  const handleConfirm = () => {
    const result = onConfirm();
    // Fire-and-close callers return void — nothing more to do here. Callers
    // that return a promise get the managed spinner: stay open and busy until
    // it settles, then close via onCancel (which every caller wires to reset
    // its own open state).
    if (result instanceof Promise) {
      setBusy(true);
      void result.finally(() => {
        setBusy(false);
        onCancel();
      });
    }
  };

  const isBusy = loading || busy;

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
        // No backdrop-dismiss mid-action, matching Escape.
        onClick={() => !isBusy && onCancel()}
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
          <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={isBusy}
          >
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
