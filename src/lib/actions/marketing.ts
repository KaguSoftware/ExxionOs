"use server";

import { revalidatePath } from "next/cache";

import { syncTransaction } from "@/lib/actions/finance-link";
import { getSessionContext } from "@/lib/data/session";
import { normaliseLinks } from "@/lib/links";
import { toMinor } from "@/lib/money";
import { appendMovement } from "@/lib/stock-write";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Campaign,
  CampaignChannel,
  CampaignCost,
  CampaignStatus,
  Sample,
} from "@/lib/types";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Marketing: campaigns, their spend, and samples.
 *
 * ⚠️⚠️ THE TWO RULES, restated where they are easiest to break:
 *
 * 1. **CAMPAIGN SPEND IS REAL MONEY; A SAMPLE IS NOT.** `addCampaignCost` is
 *    the THIRD writer into the `transactions` contract, after Equipment and
 *    Shipping — it calls the shared `syncTransaction()` rather than its own
 *    insert. `recordSample` writes NOTHING to Finance, deliberately: the
 *    filament was expensed when it was bought, and charging again when the
 *    print is given away counts the same lira twice. Do not "fix" that by
 *    adding a transaction here.
 *
 * 2. **`campaigns.budget_minor` IS THE PLAN.** It never becomes a transaction.
 *    Only a `campaign_costs` row does.
 */

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refresh(campaignId?: string) {
  revalidatePath("/marketing");
  if (campaignId) revalidatePath(`/marketing/campaigns/${campaignId}`);
  // Campaign spend lands in Finance and in the dashboard's month totals.
  revalidatePath("/finance");
  revalidatePath("/");
}

// --- campaigns -------------------------------------------------------------

export type CampaignInput = {
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  goal: string | null;
  /** Decimal lira as typed; converted to kuruş here and nowhere else. */
  budget: number | null;
  startsOn: string | null;
  endsOn: string | null;
  notes: string | null;
  links: string[];
};

function campaignRow(input: CampaignInput) {
  return {
    name: input.name.trim().slice(0, 160) || "Untitled campaign",
    channel: pick(input.channel, CAMPAIGN_CHANNELS, "instagram"),
    status: pick(input.status, CAMPAIGN_STATUSES, "planned"),
    goal: input.goal?.trim().slice(0, 500) || null,
    // ⚠️ The PLAN. This creates no transaction, ever.
    budget_minor: input.budget == null ? 0 : Math.abs(toMinor(input.budget)),
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    notes: input.notes?.trim().slice(0, 4000) || null,
    links: normaliseLinks(input.links),
  };
}

export async function createCampaign(
  input: CampaignInput
): Promise<ActionResult<Campaign>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...campaignRow(input), created_by: ctx.userId })
    .select()
    .single<Campaign>();

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data };
}

export async function updateCampaign(
  id: string,
  input: CampaignInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update(campaignRow(input))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ ARCHIVE, NEVER DELETE.
 *
 * Deleting a campaign CASCADES its costs away — and those costs are the only
 * thing tying a past month's marketing expenses to what they were for. The
 * Finance transactions would survive (they are not children of the campaign),
 * but they would be orphaned narrative-wise: money spent on nothing nameable.
 * Archiving takes the campaign out of the active list and keeps the story.
 */
export async function archiveCampaign(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

export async function unarchiveCampaign(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

// --- campaign costs — the third writer into `transactions` -----------------

export type CampaignCostInput = {
  campaignId: string;
  label: string;
  /** Decimal lira as typed. */
  amount: number;
  spentOn: string;
};

/**
 * Log a real expense against a campaign.
 *
 * ⚠️ ONE COST ROW ↔ ONE FINANCE TRANSACTION, via the SHARED `syncTransaction()`
 * — never a hand-rolled insert here, or the two implementations drift and the
 * ledger is quietly wrong in one section. The returned id is THE ONLY LINK and
 * is stored on the row; without it the next edit creates a second transaction
 * rather than updating the first.
 */
export async function addCampaignCost(
  input: CampaignCostInput
): Promise<ActionResult<CampaignCost>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", input.campaignId)
    .maybeSingle<{ id: string; name: string }>();

  if (!campaign) return { ok: false, error: "That campaign no longer exists." };

  const amountMinor = Math.abs(toMinor(input.amount));
  if (amountMinor <= 0) return { ok: false, error: "Enter an amount." };

  const spentOn = input.spentOn || todayInIstanbul();
  const label = input.label.trim().slice(0, 200) || campaign.name;

  const transactionId = await syncTransaction(supabase, {
    existingTransactionId: null,
    amountMinor,
    direction: "out",
    occurredOn: spentOn,
    description: `${campaign.name} — ${label}`,
    categoryName: "Marketing",
    sourceType: "marketing",
    sourceId: campaign.id,
    userId: ctx.userId,
  });

  const { data, error } = await supabase
    .from("campaign_costs")
    .insert({
      campaign_id: campaign.id,
      label,
      amount_minor: amountMinor,
      spent_on: spentOn,
      // ⚠️ STORE IT. This is the only link back to Finance.
      transaction_id: transactionId,
      created_by: ctx.userId,
    })
    .select()
    .single<CampaignCost>();

  if (error) return { ok: false, error: error.message };
  refresh(campaign.id);
  return { ok: true, data };
}

/**
 * Remove a cost, and the Finance row it created.
 *
 * Unlike deleting an ORDER (where the income stays, because the money really
 * was received), a campaign cost that was entered by mistake never happened —
 * so the expense goes with it. `syncTransaction` with a null amount is how the
 * contract expresses "delete it", the same call Equipment makes when a repair
 * cost is cleared.
 */
export async function deleteCampaignCost(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: cost } = await supabase
    .from("campaign_costs")
    .select("id, campaign_id, transaction_id")
    .eq("id", id)
    .maybeSingle<{ id: string; campaign_id: string; transaction_id: string | null }>();

  if (!cost) return { ok: false, error: "That cost no longer exists." };

  await syncTransaction(supabase, {
    existingTransactionId: cost.transaction_id,
    amountMinor: null, // null = delete the transaction
    occurredOn: todayInIstanbul(),
    description: "",
    categoryName: "Marketing",
    sourceType: "marketing",
    sourceId: cost.campaign_id,
    userId: ctx.userId,
  });

  const { error } = await supabase.from("campaign_costs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh(cost.campaign_id);
  return { ok: true, data: undefined };
}

// --- samples ---------------------------------------------------------------

export type SampleInput = {
  productId: string | null;
  /** Denormalised at write time so the row reads after the product is gone. */
  description: string;
  clientId: string | null;
  campaignId: string | null;
  recipient: string | null;
  quantity: number;
  givenOn: string;
  notes: string | null;
};

/**
 * Record something given away.
 *
 * ⚠️ WRITES NO FINANCE TRANSACTION, AND MUST NOT.
 * The filament was expensed when it was bought (Equipment, phase 4) and the
 * machine time is a rate, not a payment. What the sample was WORTH is computed
 * at read time by `sampleCostMinor()` from the product — the same read-time
 * costing Phase 3 established, for the same reason: a stored cost is wrong the
 * moment a filament price changes.
 *
 * If the sample was physically printed for the occasion, the caller can log a
 * PRINT RUN separately (`recordPrintRun` in actions/creative.ts) — that is the
 * real-world event that empties a spool, and it is deliberately a distinct
 * decision from "we gave one away".
 */
export async function recordSample(
  input: SampleInput
): Promise<ActionResult<Sample>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  // Denormalise the product name if the caller didn't supply a description.
  let description = input.description.trim().slice(0, 200);
  if (!description && input.productId) {
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", input.productId)
      .maybeSingle<{ name: string }>();
    description = product?.name ?? "";
  }

  const { data, error } = await supabase
    .from("samples")
    .insert({
      product_id: input.productId,
      description: description || "Sample",
      client_id: input.clientId,
      campaign_id: input.campaignId,
      recipient: input.recipient?.trim().slice(0, 160) || null,
      quantity: Math.max(1, Math.round(input.quantity || 1)),
      given_on: input.givenOn || todayInIstanbul(),
      notes: input.notes?.trim().slice(0, 2000) || null,
      created_by: ctx.userId,
    })
    .select()
    .single<Sample>();

  if (error) return { ok: false, error: error.message };

  // ⚠️ A GIVEAWAY MOVES REAL INVENTORY, even though it moves no money. The
  // unit physically left the building exactly as a sale does, so stock must
  // say so — otherwise the shelf count reads high and an order gets promised
  // against a keychain that is already in someone else's hand.
  //
  // This is NOT in tension with the no-transaction rule above: that rule is
  // about MONEY (the filament was expensed when it was bought). Units and lira
  // are different ledgers.
  if (data.product_id) {
    const movement = await appendMovement(supabase, ctx.userId, {
      productId: data.product_id,
      delta: -data.quantity,
      reason: "sample",
      sourceId: data.id,
    });
    if (!movement.ok) {
      console.error("stock: sample movement failed", data.id, movement.error);
    }
  }

  refresh(input.campaignId ?? undefined);
  revalidatePath("/creative");
  return { ok: true, data };
}

export async function deleteSample(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  // Read before deleting: the movement's source points at this row, and after
  // the delete there would be nothing left to say what to put back.
  const { data: sample } = await supabase
    .from("samples")
    .select("product_id, quantity")
    .eq("id", id)
    .maybeSingle<{ product_id: string | null; quantity: number }>();

  const { error } = await supabase.from("samples").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Un-logging a giveaway puts the unit back — as its own positive row, since
  // the ledger is append-only.
  if (sample?.product_id) {
    const reversal = await appendMovement(supabase, ctx.userId, {
      productId: sample.product_id,
      delta: sample.quantity,
      reason: "sample",
      sourceId: id,
    });
    if (!reversal.ok) {
      console.error("stock: sample reversal failed", id, reversal.error);
    }
  }

  refresh();
  revalidatePath("/creative");
  return { ok: true, data: undefined };
}
