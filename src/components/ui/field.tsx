"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Label + control + hint/error wrapper.
 *
 * ⚠️ `Field` does NOT generate the id — the CALLER must pass one, from
 * `useId()`. That is deliberate: on KaguOs a form hardcoded `id="title"` and
 * worked fine until two of the same form rendered at once, at which point every
 * label pointed at the FIRST row's input and clicking a label focused the
 * wrong record's field. Hardcoded ids are only safe when you can guarantee one
 * instance, and you usually can't.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: string;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline gap-1.5 text-xs font-medium text-muted"
      >
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            *
          </span>
        )}
        {optional && <span className="text-faint">({optional})</span>}
      </label>

      {/* The control reads `aria-describedby` from here via cloneElement-free
          convention: callers pass id + aria-describedby themselves where it
          matters. Keeping the wiring explicit avoids magic. */}
      <div data-described-by={describedBy}>{children}</div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
