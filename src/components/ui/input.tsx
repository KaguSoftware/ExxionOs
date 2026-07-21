"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/**
 * ⚠️ There is deliberately NO native `<select>` export here. Every select in
 * this app is `ui/dropdown.tsx` — a native select cannot be styled
 * consistently across platforms and breaks the typed-control rule.
 */

export const controlBase = cn(
  "w-full rounded-lg border border-line bg-bg text-ink",
  "placeholder:text-faint",
  "transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
  "hover:border-line-strong",
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
  "disabled:cursor-not-allowed disabled:opacity-55"
);

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Rendered inside the control at the leading edge (RTL-aware). */
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
};

export function TextInput({
  className,
  leading,
  trailing,
  invalid,
  ...props
}: TextInputProps) {
  const input = (
    <input
      // The control draws its own focus treatment, so opt out of the global
      // outline to avoid a double ring.
      data-no-ring
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "h-9 px-3 text-sm",
        leading && "ps-9",
        trailing && "pe-9",
        invalid && "border-danger focus:border-danger focus:ring-danger/25",
        className
      )}
      {...props}
    />
  );

  if (!leading && !trailing) return input;

  return (
    <div className="relative">
      {leading && (
        // `start-0`, not `left-0` — this must mirror in Farsi.
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center text-faint">
          {leading}
        </span>
      )}
      {input}
      {trailing && (
        <span className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-faint">
          {trailing}
        </span>
      )}
    </div>
  );
}

export function TextArea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      data-no-ring
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        "min-h-[5rem] resize-y px-3 py-2 text-sm leading-relaxed",
        invalid && "border-danger focus:border-danger focus:ring-danger/25",
        className
      )}
      {...props}
    />
  );
}

/**
 * Typed inputs. Bare strings for typed content is the thing these exist to
 * prevent — an email field that accepts anything is a text field wearing a
 * label.
 */
export function EmailInput(props: TextInputProps) {
  return <TextInput type="email" inputMode="email" autoComplete="email" {...props} />;
}

export function UrlInput(props: TextInputProps) {
  return <TextInput type="url" inputMode="url" placeholder="https://…" {...props} />;
}

export function PasswordInput(props: TextInputProps) {
  return <TextInput type="password" autoComplete="current-password" {...props} />;
}
