"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/client";
import { formatMinor } from "@/lib/utils";

/**
 * The forward-looking money the "this month" strip can't show: what work is on
 * the books, and how much of it is still owed.
 *
 * ⚠️ NEITHER FIGURE IS REVENUE. "Open orders" sums `orders.total_minor` — the
 * AGREED PRICE — on purpose and says so; it answers "what's in the pipeline",
 * never "what we earned" (earned money is Finance, from `transactions`).
 * "Outstanding" already has deposits subtracted (`outstandingMinor` per order),
 * so it is what is genuinely still owed, not the headline price.
 *
 * Deep-links to the board, where those orders live.
 */
export function MoneyPulse({
  openOrderValueMinor,
  outstandingMinor,
}: {
  openOrderValueMinor: number;
  outstandingMinor: number;
}) {
  const { t } = useI18n();

  // No open work: no strip. An all-zero row is furniture, same rule as
  // MonthSummary.
  if (openOrderValueMinor === 0 && outstandingMinor === 0) return null;

  return (
    <Link
      href="/shipping"
      className="group mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
    >
      <span className="text-xs text-muted">{t("dashboard.pulse")}</span>

      <Figure
        label={t("dashboard.openOrders")}
        value={formatMinor(openOrderValueMinor)}
      />
      <Figure
        label={t("dashboard.outstanding")}
        value={formatMinor(outstandingMinor)}
        // Money still owed leans on the warning ink when there is any — a state,
        // and it is carried by the word beside it too, never colour alone.
        emphasise={outstandingMinor > 0}
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
  emphasise,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-faint">{label}</span>
      <span
        className={
          "tnum text-sm font-medium " + (emphasise ? "text-warning" : "text-ink")
        }
      >
        {value}
      </span>
    </span>
  );
}
