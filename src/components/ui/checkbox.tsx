"use client";

import { Check, Minus } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The ONE checkbox. Never a bare `type="checkbox"` anywhere in the app.
 *
 * A real input sits underneath (opacity-0, full size) so keyboard focus,
 * space-to-toggle, form participation and screen-reader semantics are all
 * native — the visible box is a sibling driven by `peer-*`. Reinventing those
 * behaviours in JS is how custom checkboxes end up inaccessible.
 */
export function Checkbox({
  label,
  description,
  indeterminate,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
}) {
  return (
    <label
      className={cn(
        "group inline-flex cursor-pointer items-start gap-2.5",
        props.disabled && "cursor-not-allowed opacity-55",
        className
      )}
    >
      <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center">
        <input
          type="checkbox"
          data-no-ring
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "grid size-4 place-items-center rounded border border-line-strong bg-bg",
            "transition-[background-color,border-color] duration-[var(--dur-fast)]",
            "peer-hover:border-brand",
            "peer-checked:border-brand peer-checked:bg-brand",
            "peer-indeterminate:border-brand peer-indeterminate:bg-brand",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-brand/35 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-bg"
          )}
        >
          {indeterminate ? (
            <Minus className="size-3 text-brand-ink" strokeWidth={3} />
          ) : (
            <Check
              className="size-3 scale-0 text-brand-ink transition-transform duration-[var(--dur-fast)] peer-checked:scale-100 group-has-[:checked]:scale-100"
              strokeWidth={3}
            />
          )}
        </span>
      </span>

      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-ink">{label}</span>}
          {description && (
            <span className="block text-xs text-muted">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
