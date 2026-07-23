import { productCost } from "@/lib/costing";
import type {
  Campaign,
  CampaignChannel,
  CampaignCost,
  CampaignStatus,
  Client,
  EventKind,
  Supply,
  Product,
  Sample,
} from "@/lib/types";

/**
 * Marketing arithmetic. Pure — no React, no Supabase — so it is directly
 * testable, like `lib/clients.ts`, `lib/shipping.ts` and `lib/costing.ts`.
 *
 * ⚠️⚠️ THE TWO RULES THIS FILE ENFORCES:
 *
 * 1. **`campaigns.budget_minor` IS THE PLAN; `transactions` IS THE MONEY.**
 *    Never add a budget to a spend to report "what marketing cost" — that
 *    reports roughly double, the same family of bug as summing
 *    `maintenance_logs.cost_minor` (Phase 4), `orders.total_minor` (Phase 5)
 *    and ranking clients by agreed prices (Phase 6). A campaign planned at
 *    ₺5.000 that never ran spent ₺0.
 *
 * 2. **A SAMPLE IS COSTED, NEVER EXPENSED.** Nothing here produces a
 *    transaction. The filament was expensed when it was bought; charging again
 *    when the print is given away counts the same lira twice. What a sample is
 *    WORTH is computed at read time from the product, exactly as Phase 3
 *    computes product cost — and it goes stale the moment it is stored, which
 *    is why it never is.
 */

/** Value → i18n key, in one place each, like `STAGE_KEY` in lib/shipping.ts. */
export const CAMPAIGN_CHANNEL_KEY: Record<CampaignChannel, string> = {
  instagram: "marketing.channelInstagram",
  tiktok: "marketing.channelTiktok",
  market: "marketing.channelMarket",
  collab: "marketing.channelCollab",
  print: "marketing.channelPrint",
  other: "marketing.channelOther",
};

export const CAMPAIGN_STATUS_KEY: Record<CampaignStatus, string> = {
  planned: "marketing.statusPlanned",
  running: "marketing.statusRunning",
  done: "marketing.statusDone",
  cancelled: "marketing.statusCancelled",
};

/** The three `events` kinds this section's lens shows. */
export const MARKETING_EVENT_KIND_KEY: Record<string, string> = {
  filming: "marketing.kindFilming",
  networking: "marketing.kindNetworking",
  campaign: "marketing.kindCampaign",
};

export const MARKETING_KINDS: EventKind[] = ["filming", "networking", "campaign"];

/** What a campaign has actually spent, in kuruş. */
export function campaignSpendMinor(costs: CampaignCost[]): number {
  return costs.reduce((sum, c) => sum + c.amount_minor, 0);
}

export type BudgetUsage = {
  spentMinor: number;
  budgetMinor: number;
  /**
   * Spent ÷ budget.
   *
   * ⚠️ NULL when the budget is 0, never 0. "0% of budget used" on a campaign
   * with no budget reads as headroom that does not exist — and the bar that
   * renders it would sit reassuringly empty while money goes out. Unbudgeted
   * is a different statement from under-budget, and the UI says so.
   */
  ratio: number | null;
  /** True only when there IS a budget and it has been passed. */
  overBudget: boolean;
};

export function budgetUsage(
  campaign: Pick<Campaign, "budget_minor">,
  costs: CampaignCost[]
): BudgetUsage {
  const spentMinor = campaignSpendMinor(costs);
  const budgetMinor = campaign.budget_minor;
  const hasBudget = budgetMinor > 0;

  return {
    spentMinor,
    budgetMinor,
    ratio: hasBudget ? spentMinor / budgetMinor : null,
    overBudget: hasBudget && spentMinor > budgetMinor,
  };
}

/**
 * What one sample line was worth to give away, in kuruş.
 *
 * ⚠️ RETURNS NULL, NEVER 0, when the product is gone or was never costed.
 * Rendering ₺0,00 would claim the giveaway was FREE — a different and much
 * more flattering statement than "we don't know what it cost". Same rule as
 * `productCost()` itself.
 */
export function sampleCostMinor(
  sample: Pick<Sample, "product_id" | "quantity">,
  products: Product[],
  supplies: Supply[],
  machineHourRateMinor: number,
  laborHourRateMinor: number
): number | null {
  if (!sample.product_id) return null;
  const product = products.find((p) => p.id === sample.product_id);
  if (!product) return null; // Deleted from Creative — the row survives, the cost can't.

  const cost = productCost(product, supplies, machineHourRateMinor, laborHourRateMinor);
  if (!cost) return null;

  return cost.totalMinor * Math.max(1, sample.quantity);
}

export type GivenAway = {
  /** Cost of everything that COULD be costed. */
  totalMinor: number;
  /** How many sample rows are included in that figure. */
  costedCount: number;
  /**
   * ⚠️ How many could NOT be costed, reported rather than swallowed. Without
   * this the total silently under-reports and looks authoritative — the same
   * honesty the per-collection P&L applies to lines whose product was deleted.
   */
  uncostedCount: number;
};

export function givenAwayMinor(
  samples: Sample[],
  products: Product[],
  supplies: Supply[],
  machineHourRateMinor: number,
  laborHourRateMinor: number
): GivenAway {
  let totalMinor = 0;
  let costedCount = 0;
  let uncostedCount = 0;

  for (const sample of samples) {
    const minor = sampleCostMinor(
      sample,
      products,
      supplies,
      machineHourRateMinor,
      laborHourRateMinor
    );
    if (minor == null) uncostedCount++;
    else {
      totalMinor += minor;
      costedCount++;
    }
  }

  return { totalMinor, costedCount, uncostedCount };
}

export type MonthCount = { month: string; count: number };

/**
 * New clients per month, by how they found Exxion.
 *
 * ⚠️ THIS IS THE HONEST SIGNAL, and it is deliberately NOT called ROI. Nothing
 * in the data proves a given order came from a given campaign, so this section
 * must never print a number claiming it did — an invented attribution figure is
 * worse than none, because it gets believed and then acted on. What can be
 * defended is: people arrived, and this is the channel they said they came
 * from. Reading a rise here next to a campaign is a judgement the human makes,
 * not a claim the software makes for them.
 */
export function newClientsBySourceByMonth(
  clients: Pick<Client, "created_at" | "source">[],
  months = 12
): { months: string[]; bySource: Map<string, MonthCount[]> } {
  const keys: string[] = [];
  const sorted = [...clients].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Build the month axis from the data itself rather than a clock read — this
  // file stays pure, and `react-hooks/purity` is an error in this project.
  const seen = new Set<string>();
  for (const c of sorted) seen.add(c.created_at.slice(0, 7));
  for (const m of [...seen].sort().slice(-months)) keys.push(m);

  const bySource = new Map<string, MonthCount[]>();
  for (const client of sorted) {
    const month = client.created_at.slice(0, 7);
    if (!keys.includes(month)) continue;
    // ⚠️ The unknown bucket is KEPT, as in `bySource()` in lib/clients.ts.
    const key = client.source ?? "__unknown";
    const series =
      bySource.get(key) ?? keys.map((m) => ({ month: m, count: 0 }));
    const point = series.find((p) => p.month === month);
    if (point) point.count++;
    bySource.set(key, series);
  }

  return { months: keys, bySource };
}

/** Campaigns that are running AND past their budget — what needs a human. */
export function overBudgetCampaigns(
  campaigns: Campaign[],
  costsByCampaign: Map<string, CampaignCost[]>
): Campaign[] {
  return campaigns.filter((c) => {
    if (c.archived_at || c.status === "cancelled" || c.status === "done") return false;
    return budgetUsage(c, costsByCampaign.get(c.id) ?? []).overBudget;
  });
}

/**
 * Return-on-investment per campaign — real, not invented.
 *
 * ⚠️ THE ATTRIBUTION IS HUMAN-ENTERED (orders.campaign_id, 0019), never guessed.
 * This function reports ROI ONLY for orders a human explicitly tagged to a
 * campaign, and it surfaces `untaggedOrders` so the figure never pretends to
 * cover the whole business. Phase 7 refused to show ROI at all because nothing
 * linked an order to a campaign; 0019 adds that link, and this respects its
 * limits rather than papering over them.
 *
 * ⚠️ REVENUE IS MONEY THAT ARRIVED (`transactions`), NEVER `orders.total_minor`.
 * Same rule as `revenueByClient()` — a tagged order that was quoted but never
 * paid contributes ₺0, not its agreed price. `receivedByOrder` is the sum of
 * `transactions` where `source_type='order'`, keyed by order id, sign already
 * applied (refunds subtract).
 *
 * ⚠️ SPEND IS FINANCE-SOURCED (`spendByCampaign`, the sum of `transactions`
 * tagged to the campaign) — the SAME figure the spend panel shows, never the
 * budget. Passing it in keeps ROI and the spend bars consistent by construction.
 */
export type CampaignRoi = {
  campaignId: string;
  /** Money received on orders tagged to this campaign. */
  revenueMinor: number;
  /** What the campaign actually spent (from Finance). */
  spendMinor: number;
  /** revenue − spend. */
  netMinor: number;
  /** How many tagged orders fed the revenue figure. */
  orderCount: number;
};

export function campaignRoi(
  campaigns: Pick<Campaign, "id">[],
  taggedOrders: { id: string; campaign_id: string | null }[],
  receivedByOrder: Map<string, number>,
  spendByCampaign: Map<string, number>
): { roi: CampaignRoi[]; untaggedOrders: number } {
  let untaggedOrders = 0;
  const ordersByCampaign = new Map<string, string[]>();
  for (const order of taggedOrders) {
    if (!order.campaign_id) {
      untaggedOrders++;
      continue;
    }
    const list = ordersByCampaign.get(order.campaign_id);
    if (list) list.push(order.id);
    else ordersByCampaign.set(order.campaign_id, [order.id]);
  }

  const roi = campaigns.map((campaign) => {
    const orderIds = ordersByCampaign.get(campaign.id) ?? [];
    const revenueMinor = orderIds.reduce(
      (sum, id) => sum + (receivedByOrder.get(id) ?? 0),
      0
    );
    const spendMinor = Math.max(0, spendByCampaign.get(campaign.id) ?? 0);
    return {
      campaignId: campaign.id,
      revenueMinor,
      spendMinor,
      netMinor: revenueMinor - spendMinor,
      orderCount: orderIds.length,
    };
  });

  return { roi, untaggedOrders };
}

/** Group helper — costs arrive as one flat list from the page's single wave. */
export function groupCosts(costs: CampaignCost[]): Map<string, CampaignCost[]> {
  const map = new Map<string, CampaignCost[]>();
  for (const cost of costs) {
    const list = map.get(cost.campaign_id);
    if (list) list.push(cost);
    else map.set(cost.campaign_id, [cost]);
  }
  return map;
}
