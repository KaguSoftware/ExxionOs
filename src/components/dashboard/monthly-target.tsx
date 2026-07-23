"use client";

import { Target } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/client";
import { formatMinor } from "@/lib/utils";

/**
 * Progress toward the monthly revenue target.
 *
 * ⚠️ `receivedMinor` is MONEY THAT ARRIVED — the sum of this month's
 * `direction:'in'` transactions, never `orders.total_minor`. A quoted-but-unpaid
 * order moves this bar by nothing, which is the honest behaviour.
 *
 * ⚠️ When no target is set (`targetMinor` null or 0) the ratio is undefined, so
 * this shows a quiet "set a target" prompt rather than a 0%/∞% bar — same
 * null-not-zero rule as campaign budget usage.
 */
export function MonthlyTarget({
  receivedMinor,
  targetMinor,
}: {
  receivedMinor: number;
  targetMinor: number | null;
}) {
  const { t } = useI18n();

  if (targetMinor == null || targetMinor <= 0) {
    return (
      <Link
        href="/settings"
        className="group mt-1 flex items-center gap-2 rounded-xl border border-line border-dashed bg-surface px-4 py-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <Target aria-hidden className="size-4 text-faint" />
        {t("dashboard.setTarget")}
      </Link>
    );
  }

  const ratio = receivedMinor / targetMinor;
  const pct = Math.round(ratio * 100);
  const reached = receivedMinor >= targetMinor;

  return (
    <div className="mt-1 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-xs text-muted">
          <Target aria-hidden className="size-4 text-faint" />
          {t("dashboard.monthlyTarget")}
        </span>
        <span className="text-sm text-ink">
          <span className="tnum font-medium">{formatMinor(receivedMinor)}</span>
          <span className="text-faint">
            {" / "}
            {formatMinor(targetMinor)}
          </span>
          <span className="tnum ms-2 text-xs text-muted">
            {t("dashboard.ofTarget", { pct })}
          </span>
        </span>
      </div>

      {/* Bar caps its FILL at 100% so an over-target month doesn't overflow the
          track, but the label above still shows the true percentage. */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
        <div
          className={reached ? "h-full rounded-full bg-success" : "h-full rounded-full bg-brand"}
          style={{ inlineSize: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
