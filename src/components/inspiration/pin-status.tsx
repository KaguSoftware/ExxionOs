"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import type { IdeaStatus } from "@/lib/types";
import { IDEA_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_KEY: Record<IdeaStatus, string> = {
  new: "inspiration.statusNew",
  exploring: "inspiration.statusExploring",
  dropped: "inspiration.statusDropped",
  made: "inspiration.statusMade",
};

/**
 * The one status control, shared by the quick-look and the pin page.
 *
 * ⚠️ `made` IS DELIBERATELY NOT SETTABLE. It means "this became a collection"
 * and only `promoteIdea` writes it, because the collection has to exist first.
 * Offering it as a button would let you claim a project that isn't there. When
 * a pin is in that state the control renders as a badge instead.
 *
 * ⚠️ This does NOT appear on the wall's tiles. A picture wall that prints a
 * four-state workflow under every photograph stops reading as a wall — status
 * lives one tap away, in the quick-look.
 */
export function PinStatusControl({
  status,
  onChange,
  size = "md",
}: {
  status: IdeaStatus;
  onChange: (status: IdeaStatus) => void;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-1">
      {IDEA_STATUSES.filter((s) => s !== "made").map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={status === value}
          className={cn(
            "rounded border transition-colors duration-[var(--dur-fast)]",
            size === "sm" ? "px-1.5 py-0.5 text-2xs" : "px-2 py-1 text-xs",
            status === value
              ? "border-brand bg-brand-soft text-ink"
              : "border-line text-muted hover:text-ink"
          )}
        >
          {t(STATUS_KEY[value] as never)}
        </button>
      ))}
      {status === "made" && (
        <Badge tone="accent">{t("inspiration.statusMade")}</Badge>
      )}
    </div>
  );
}
