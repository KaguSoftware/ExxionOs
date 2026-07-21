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

/**
 * ⚠️ THE TEXT TOKEN IS `-badge`, NOT the plain family token. `--success` and
 * friends are measured as text on the PAGE; on their own `-soft` field they
 * measured as low as 3.91:1 (light success) and 4.18:1 (dark danger). The
 * `-badge` values are solved against the composited tint. Do not "simplify"
 * these back to `text-success` — it reads identically and fails AA.
 *
 * Every tone carries a visible border, including the ones that used to be
 * `border-transparent`: two badges on one row with different border weights
 * read as two different sizes of thing, the same argument the Button variants
 * make about keeping the box constant.
 */
const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-muted border-line",
  brand: "bg-brand-soft text-brand-badge border-brand-line",
  accent: "bg-accent-soft text-accent-badge border-accent/25",
  success: "bg-success-soft text-success-badge border-success/25",
  warning: "bg-warning-soft text-warning-badge border-warning/25",
  danger: "bg-danger-soft text-danger-badge border-danger/25",
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
