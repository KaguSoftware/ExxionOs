import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one container. A panel is a bordered region with an optional titled
 * header — used for every grouped area in the app.
 *
 * ⚠️ Panels do not nest. A panel inside a panel is the "nested card" smell:
 * if a region inside a panel needs separating, use a hairline rule or spacing,
 * not a second border.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface shadow-[var(--shadow-1)]",
        className
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 row-comfortable border-b border-line">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export { PageHeader } from "./page-header";
