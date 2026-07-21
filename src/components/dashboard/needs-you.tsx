"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

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
export function NeedsYou({
  dueCount,
  openIssues = 0,
  machinesDown = 0,
  lowSupplies = 0,
  ordersOverdue = 0,
  ordersUnpaid = 0,
}: {
  dueCount: number;
  openIssues?: number;
  machinesDown?: number;
  lowSupplies?: number;
  /** Past their promised date and not yet delivered or cancelled. */
  ordersOverdue?: number;
  /** Delivered with money still owed — the one that costs real money. */
  ordersUnpaid?: number;
}) {
  const t = useT();

  // Nothing needs you: render nothing at all.
  if (
    dueCount === 0 &&
    openIssues === 0 &&
    machinesDown === 0 &&
    lowSupplies === 0 &&
    ordersOverdue === 0 &&
    ordersUnpaid === 0
  )
    return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5">
      <AlertCircle aria-hidden className="size-4 shrink-0 text-danger" />
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {t("dashboard.needsYou")}
      </span>

      {dueCount > 0 && (
        <span className="text-sm text-ink">
          {dueCount === 1
            ? t("dashboard.reminderDue")
            : t("dashboard.remindersDue", { count: dueCount })}
        </span>
      )}

      {openIssues > 0 && (
        // Deep-links to Learnings filtered to open issues. `?tab=` is the real
        // param the tab shell reads — see components/shell/tabbed-panels.tsx.
        <Link
          href="/creative?tab=learnings"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          {openIssues === 1
            ? t("creative.openIssue")
            : t("creative.openIssues", { count: openIssues })}
        </Link>
      )}

      {/* ⚠️ Phase 4 passed these two in but never rendered them, so a broken
          machine reached the dashboard and then vanished. Caught in Phase 5. */}
      {machinesDown > 0 && (
        <Link
          href="/equipment?tab=machines"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          {machinesDown === 1
            ? t("equipment.brokenOne")
            : t("equipment.brokenCount", { count: machinesDown })}
        </Link>
      )}

      {lowSupplies > 0 && (
        <Link
          href="/equipment?tab=supplies"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          {lowSupplies === 1
            ? t("equipment.lowOne")
            : t("equipment.lowCount", { count: lowSupplies })}
        </Link>
      )}

      {ordersOverdue > 0 && (
        <Link
          href="/shipping?tab=board"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          {t("dashboard.ordersOverdue", { count: ordersOverdue })}
        </Link>
      )}

      {ordersUnpaid > 0 && (
        <Link
          href="/shipping?tab=list"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          {t("dashboard.ordersUnpaid", { count: ordersUnpaid })}
        </Link>
      )}
    </div>
  );
}
