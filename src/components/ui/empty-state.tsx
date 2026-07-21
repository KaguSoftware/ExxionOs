import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * An empty state TEACHES the surface — it says what this area is for and how
 * to put the first thing in it. "No items yet" alone is a dead end.
 *
 * ⚠️ An empty state must never be how a FAILURE looks. Every query goes
 * through `rowsOrThrow`, so a broken query throws to the error boundary
 * instead of rendering this. If you ever find yourself rendering an empty
 * state on error, fix the query, not the empty state.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-1 grid size-10 place-items-center rounded-full border border-line bg-raised text-faint">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-xs leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
