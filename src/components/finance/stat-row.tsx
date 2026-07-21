"use client";

import { useI18n } from "@/lib/i18n/client";
import { cn, formatMinor } from "@/lib/utils";

/**
 * This month's headline figures.
 *
 * ⚠️ THE +/− SIGNS ARE REQUIRED, NOT DECORATIVE. The green/red money pair sits
 * in the measured "floor band" for colourblind separation (ΔE 6.5 under
 * protanopia), which is only legal WITH secondary encoding. The sign and the
 * label ARE that encoding — they are what stop income and expense from being
 * distinguished by colour alone. Do not remove them to tidy the layout.
 */
export function StatRow({
  totals,
}: {
  totals: { inMinor: number; outMinor: number; netMinor: number };
}) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
      <Stat
        label={t("finance.income")}
        value={`+${formatMinor(totals.inMinor)}`}
        tone="in"
      />
      <Stat
        label={t("finance.expense")}
        value={`−${formatMinor(totals.outMinor)}`}
        tone="out"
      />
      <Stat
        label={t("finance.net")}
        // Net carries its own sign from its value: a negative month must be
        // unmistakable.
        value={`${totals.netMinor >= 0 ? "+" : "−"}${formatMinor(Math.abs(totals.netMinor))}`}
        tone={totals.netMinor >= 0 ? "in" : "out"}
        emphasis
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  emphasis = false,
}: {
  label: string;
  value: string;
  tone: "in" | "out";
  emphasis?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        {label}
        <span className="sr-only"> — {t("finance.thisMonth")}</span>
      </p>
      <p
        className={cn(
          "tnum mt-1 text-xl font-semibold",
          // Colour REINFORCES the sign; it never carries the meaning alone.
          // Only the Net tile is tinted — on the in/out tiles the label and the
          // sign already say which is which, and tinting all three would make
          // the row a wall of colour with nothing standing out.
          emphasis ? (tone === "in" ? "text-success" : "text-danger") : "text-ink"
        )}
      >
        {value}
      </p>
    </div>
  );
}
