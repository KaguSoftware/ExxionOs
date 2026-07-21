import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * ⚠️ COLOUR MARKS STATE, NOT CATEGORY.
 *
 * `success` / `warning` / `danger` are the STATE vocabulary — done, due soon,
 * overdue/broken. Do not reach for one because a category badge looked plain:
 * on KaguOs a green "feature" tag sat 5% away from the green "done" state on
 * the same row and had to be pulled. A category is carried by its icon and its
 * word, using the `neutral` tone.
 */
type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-muted border-line",
  brand: "bg-brand-soft text-brand-text border-brand-line",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-2xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
