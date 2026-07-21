import type {
  Order,
  OrderLine,
  OrderPayment,
  OrderStage,
  OrderStageEvent,
} from "@/lib/types";
import { ORDER_FLOW } from "@/lib/types";

/**
 * Order arithmetic. Pure — no React, no Supabase — so the money logic is
 * directly testable, which for money it must be. Same reasoning as
 * `lib/finance-series.ts` and `lib/costing.ts`.
 */

/** Stage → i18n key. */
export const STAGE_KEY: Record<OrderStage, string> = {
  enquiry: "shipping.stageEnquiry",
  quoted: "shipping.stageQuoted",
  printing: "shipping.stagePrinting",
  post_processing: "shipping.stagePostProcessing",
  packed: "shipping.stagePacked",
  shipped: "shipping.stageShipped",
  delivered: "shipping.stageDelivered",
  cancelled: "shipping.stageCancelled",
};

/**
 * Board ordering. `delivered` closes the pipeline; `cancelled` sits apart
 * because it is an exit, not a step.
 */
export const STAGE_RANK: Record<OrderStage, number> = {
  enquiry: 0,
  quoted: 1,
  printing: 2,
  post_processing: 3,
  packed: 4,
  shipped: 5,
  delivered: 6,
  cancelled: 7,
};

export function isTerminal(stage: OrderStage): boolean {
  return stage === "delivered" || stage === "cancelled";
}

/** The sum a set of lines comes to, in kuruş. Exact — integers throughout. */
export function linesTotalMinor(lines: OrderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price_minor,
    0
  );
}

/**
 * What has actually been received, in kuruş. A refund subtracts.
 *
 * ⚠️ This reads PAYMENTS, not `orders.total_minor`. The total is what was
 * agreed; this is what arrived, and they are routinely different — Exxion takes
 * deposits, and a quoted order may never be paid at all.
 */
export function paidMinor(payments: OrderPayment[]): number {
  return payments.reduce(
    (sum, p) => sum + (p.kind === "refund" ? -p.amount_minor : p.amount_minor),
    0
  );
}

/**
 * ⚠️ THE NUMBER THE WHOLE PHASE TURNS ON.
 *
 * What is still owed = agreed total − received so far. This is what reaching
 * `delivered` prompts for, which is why a deposit can never be double-counted:
 * the balance prompt already has it subtracted.
 *
 * Floors at 0 — an overpayment is not a negative debt, and showing "−₺200 due"
 * reads as an error rather than as credit.
 */
export function outstandingMinor(
  order: Pick<Order, "total_minor">,
  payments: OrderPayment[]
): number {
  return Math.max(0, order.total_minor - paidMinor(payments));
}

export function isFullyPaid(
  order: Pick<Order, "total_minor">,
  payments: OrderPayment[]
): boolean {
  return order.total_minor > 0 && outstandingMinor(order, payments) === 0;
}

/**
 * Milliseconds spent in each stage, derived from consecutive events.
 *
 * ⚠️ This is why `order_stage_events` is append-only rather than a
 * `stage_changed_at` column: the duration of a stage needs the moment it was
 * ENTERED and the moment the NEXT one was, and a single column only ever knows
 * the latest. The final (current) stage is open-ended, so it is measured to
 * `now` only when the order is still active.
 */
export function stageDurations(
  events: OrderStageEvent[],
  opts: { openUntil?: number } = {}
): { stage: OrderStage; ms: number }[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.entered_at) - Date.parse(b.entered_at)
  );
  const out: { stage: OrderStage; ms: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const start = Date.parse(sorted[i].entered_at);
    const next = sorted[i + 1];
    const end = next ? Date.parse(next.entered_at) : opts.openUntil;
    if (end == null) continue; // Current stage of a finished order — no span.
    out.push({ stage: sorted[i].stage, ms: Math.max(0, end - start) });
  }
  return out;
}

/**
 * Median milliseconds per stage across many orders.
 *
 * ⚠️ Median, not mean: one order that sat in "quoted" for six months while a
 * client went quiet would drag an average into uselessness. The median answers
 * "how long does this normally take", which is the question being asked.
 */
export function medianStageDurations(
  eventsByOrder: Map<string, OrderStageEvent[]>,
  now: number
): { stage: OrderStage; ms: number }[] {
  const buckets = new Map<OrderStage, number[]>();

  for (const events of eventsByOrder.values()) {
    const last = events.length
      ? events.reduce((a, b) =>
          Date.parse(a.entered_at) > Date.parse(b.entered_at) ? a : b
        )
      : null;
    // Only keep the clock running for orders still moving.
    const openUntil = last && !isTerminal(last.stage) ? now : undefined;

    for (const { stage, ms } of stageDurations(events, { openUntil })) {
      const list = buckets.get(stage);
      if (list) list.push(ms);
      else buckets.set(stage, [ms]);
    }
  }

  return ORDER_FLOW.filter((stage) => buckets.has(stage)).map((stage) => {
    const list = [...buckets.get(stage)!].sort((a, b) => a - b);
    const mid = Math.floor(list.length / 2);
    const ms =
      list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid];
    return { stage, ms };
  });
}

const DAY_MS = 86_400_000;

/** Whole days, for a compact axis. Sub-day spans round up to 1, never to 0. */
export function msToDays(ms: number): number {
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / DAY_MS));
}

/**
 * Share of finished enquiries that were cancelled rather than delivered.
 * Returns null when nothing has finished yet — a rate over zero orders is a
 * meaningless 0%, which reads as good news.
 */
export function lostRate(orders: Pick<Order, "stage">[]): number | null {
  const delivered = orders.filter((o) => o.stage === "delivered").length;
  const cancelled = orders.filter((o) => o.stage === "cancelled").length;
  const finished = delivered + cancelled;
  if (finished === 0) return null;
  return cancelled / finished;
}
