"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  description,
  children,
  wide = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** For composer-type surfaces that need more than a single column. */
  wide?: boolean;
}) {
  const router = useRouter();
  const t = useT();

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

        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-[65ch] text-sm text-muted">{description}</p>
        )}

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
  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 overflow-y-auto bg-bg"
      style={{ zIndex: "var(--z-overlay)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8">
        <button
          type="button"
          onClick={onClose}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("common.back")}
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
