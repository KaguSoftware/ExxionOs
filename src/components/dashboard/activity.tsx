"use client";

import { Activity as ActivityIcon, Package, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { EVENT_KIND_KEY } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY } from "@/lib/shipping";
import type { EventKind, OrderStage } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * What actually happened lately, across sections.
 *
 * ⚠️ THIS REPLACED A PLACEHOLDER THAT SAID "coming in a later phase" — which
 * was still on the dashboard after all seven phases shipped, taking half the
 * page to promise something that already existed. A panel that lies about the
 * system's state is worse than an empty one.
 *
 * Two sources, already append-only, merged on time:
 *   `order_stage_events` — every order movement, with its timestamp
 *   `events`             — calls, meetings, samples, complaints
 *
 * ⚠️ NO NEW ROUND TRIP. Both queries join the dashboard's existing single
 * wave (see the page's `Promise.all`). A wave costs ~305ms; a query added to
 * one costs ~3ms.
 *
 * ⚠️ MIXED DATE GRAINS, DELIBERATELY NORMALISED. Stage events carry a
 * `timestamptz`; client events carry a `date`, because "we met on the 4th" has
 * no meaningful time. Sorting them together on a raw string would put every
 * dated event at midnight and scramble the day's order, so both are reduced to
 * a DAY key for grouping and the timestamp is kept only as a tiebreaker.
 */

export type ActivityItem =
  | {
      type: "order";
      id: string;
      orderId: string;
      code: string | null;
      stage: OrderStage;
      /** ISO timestamp. */
      at: string;
    }
  | {
      type: "event";
      id: string;
      kind: EventKind;
      title: string;
      clientId: string | null;
      /** YYYY-MM-DD. */
      at: string;
    };

/** Day key for grouping — the part both grains genuinely share. */
const dayOf = (at: string) => at.slice(0, 10);

export function Activity({
  items,
  className,
}: {
  items: ActivityItem[];
  className?: string;
}) {
  const { t, locale } = useI18n();

  const sorted = [...items].sort((a, b) => {
    const dayDiff = dayOf(b.at).localeCompare(dayOf(a.at));
    if (dayDiff !== 0) return dayDiff;
    // Same day: the timestamped one wins the tiebreak, but only within the day
    // it actually belongs to.
    return b.at.localeCompare(a.at);
  });

  return (
    <Panel
      title={t("dashboard.recentActivity")}
      className={className}
      // ⚠️ `overflow-hidden` CLIPS the square-cornered row hover (and the day
      // header's full-width tint) to the panel's rounded-xl corners. Without it
      // the first/last row's `hover:bg-raised` paints square corners over the
      // rounded panel — the "hover bg isn't rounded" bug. Same fix as the
      // clients directory / order list containers.
      bodyClassName={sorted.length === 0 ? undefined : "p-0 overflow-hidden"}
    >
      {sorted.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon aria-hidden className="size-4" />}
          title={t("dashboard.noActivity")}
          // Teaches what fills this panel rather than just saying it's empty.
          description={t("dashboard.noActivityHint")}
        />
      ) : (
        <ul>
          {sorted.map((item, index) => {
            const previous = sorted[index - 1];
            const newDay = !previous || dayOf(previous.at) !== dayOf(item.at);

            return (
              <li key={`${item.type}-${item.id}`}>
                {newDay && (
                  <p className="border-b border-line bg-surface px-4 py-1.5 text-2xs font-medium tracking-wide text-faint uppercase">
                    {formatDate(dayOf(item.at), locale)}
                  </p>
                )}
                <ActivityRow item={item} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { t } = useI18n();

  if (item.type === "order") {
    return (
      <Link
        href={`/shipping/orders/${item.orderId}`}
        className={cn(
          "row-comfortable flex items-center gap-3 border-b border-line last:border-0",
          "transition-colors hover:bg-raised"
        )}
      >
        <Package aria-hidden className="size-4 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          {item.code ?? t("shipping.order")}
        </span>
        {/* One line per order — its CURRENT stage, read as a state ("now
            Printing"), not a stage-by-stage narration. */}
        <span className="shrink-0 text-xs text-muted">
          {t("dashboard.nowStage", {
            stage: t(STAGE_KEY[item.stage] as never),
          })}
        </span>
      </Link>
    );
  }

  const label = item.title || t(EVENT_KIND_KEY[item.kind] as never);

  // An event whose client was deleted keeps its history (the FK is SET NULL),
  // so it stays readable — it just isn't a link any more.
  const body = (
    <>
      <Users aria-hidden className="size-4 shrink-0 text-faint" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
      <span className="shrink-0 text-xs text-muted">
        {t(EVENT_KIND_KEY[item.kind] as never)}
      </span>
    </>
  );

  return item.clientId ? (
    <Link
      href={`/clients/${item.clientId}`}
      className={cn(
        "row-comfortable flex items-center gap-3 border-b border-line last:border-0",
        "transition-colors hover:bg-raised"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className="row-comfortable flex items-center gap-3 border-b border-line last:border-0">
      {body}
    </div>
  );
}
