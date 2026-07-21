"use client";

import { AlertCircle } from "lucide-react";

import { useT } from "@/lib/i18n/client";

/**
 * The first thing on the dashboard: what needs your attention.
 *
 * ⚠️ RENDERS NOTHING WHEN EVERY COUNT IS ZERO. A permanent bar reading
 * "0 overdue · 0 due · 0 to review" is furniture — it occupies the most
 * valuable space on the page to say nothing. An absent strip IS the "all
 * clear" signal.
 *
 * ⚠️ Every deep-link from here must use the TARGET PAGE'S REAL FILTER PARAMS.
 * On KaguOs this strip linked to `?preset=mine`, a param no page read, so the
 * link silently landed on an unfiltered board — it looked like a filtered
 * deep-link and filtered nothing, for months. When phases 2-7 add signals
 * here, verify the link by parsing it through the target's own filter reader.
 */
export function NeedsYou({ dueCount }: { dueCount: number }) {
  const t = useT();

  if (dueCount === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5">
      <AlertCircle aria-hidden className="size-4 shrink-0 text-danger" />
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {t("dashboard.needsYou")}
      </span>
      <span className="text-sm text-ink">
        {dueCount === 1
          ? t("dashboard.reminderDue")
          : t("dashboard.remindersDue", { count: dueCount })}
      </span>
    </div>
  );
}
