"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink hover:bg-brand-hover active:bg-brand-active border border-transparent",
  // Outline. ⚠️ Every variant carries a 1px border, including the ones that
  // look borderless (`border-transparent` above). Swapping a button between
  // variants must never change its box size — a 1px difference shifts every
  // neighbour in a flex row, which reads as the UI twitching on click.
  secondary:
    "bg-surface text-ink border border-line hover:bg-raised hover:border-line-strong",
  ghost:
    "bg-transparent text-muted border border-transparent hover:bg-surface hover:text-ink",
  // --danger-fill, not --danger: measured 6.28:1 for white text, where the
  // lighter --danger gave only 3.58:1. The one irreversible button must be
  // readable.
  danger:
    "bg-danger-fill text-danger-ink hover:brightness-110 border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-base gap-2 rounded-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  full = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      // A bare <button> inside a <form> submits it. Being explicit avoids
      // accidental submits from any button that isn't the submit button.
      type={props.type ?? "button"}
      disabled={disabled || loading}
      // aria-busy so assistive tech hears "busy" rather than nothing while a
      // save is in flight.
      aria-busy={loading || undefined}
      className={cn(
        "press inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,opacity] duration-[var(--dur-fast)]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
