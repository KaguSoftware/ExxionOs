"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { FINANCE_PARAMS } from "@/lib/use-finance-filters";
import { useI18n } from "@/lib/i18n/client";
import { cn, formatMinor } from "@/lib/utils";

/**
 * This month's money on the dashboard.
 *
 * ⚠️ THE DEEP-LINK USES THE TARGET PAGE'S REAL FILTER PARAMS
 * (`FINANCE_PARAMS`, imported rather than hardcoded so a rename can't silently
 * break it). The reference project shipped a `?preset=mine` link that no page
 * ever read — it looked like a filtered deep-link and filtered nothing, for
 * months. Importing the constants means a typo is a compile error.
 *
 * ⚠️ The +/− signs are required secondary encoding for the green/red pair —
 * see chart-palette.ts. Never colour alone.
 */
export function MonthSummary({
  totals,
  monthStart,
  today,
}: {
  totals: { inMinor: number; outMinor: number; netMinor: number };
  monthStart: string;
  today: string;
}) {
  const { t } = useI18n();

  // Nothing this month: say nothing. An all-zero strip is furniture.
  if (totals.inMinor === 0 && totals.outMinor === 0) return null;

  const href = `/finance?${FINANCE_PARAMS.from}=${monthStart}&${FINANCE_PARAMS.to}=${today}`;

  return (
    <Link
      href={href}
      className="group mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
    >
      <span className="text-xs text-muted">{t("finance.thisMonth")}</span>

      <Figure label={t("finance.income")} value={`+${formatMinor(totals.inMinor)}`} />
      <Figure label={t("finance.expense")} value={`−${formatMinor(totals.outMinor)}`} />
      <Figure
        label={t("finance.net")}
        value={`${totals.netMinor >= 0 ? "+" : "−"}${formatMinor(Math.abs(totals.netMinor))}`}
        tone={totals.netMinor >= 0 ? "in" : "out"}
      />

      <ArrowUpRight
        aria-hidden
        className="ms-auto size-4 text-faint transition-colors group-hover:text-ink rtl:-scale-x-100"
      />
    </Link>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "in" | "out";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-faint">{label}</span>
      <span
        className={cn(
          "tnum text-sm font-medium",
          tone === "in" && "text-success",
          tone === "out" && "text-danger",
          !tone && "text-ink"
        )}
      >
        {value}
      </span>
    </span>
  );
}
