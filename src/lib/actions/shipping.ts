"use server";

import { revalidatePath } from "next/cache";

import { syncTransaction } from "@/lib/actions/finance-link";
import { getSessionContext } from "@/lib/data/session";
import { toMinor } from "@/lib/money";
import { outstandingMinor } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Order,
  OrderPayment,
  OrderStage,
  PaymentKind,
} from "@/lib/types";
import { ORDER_STAGES, PAYMENT_KINDS } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refresh(orderId?: string) {
  revalidatePath("/shipping");
  if (orderId) revalidatePath(`/shipping/orders/${orderId}`);
  // A payment lands in Finance and in the dashboard totals; lines change the
  // per-collection P&L in Creative.
  revalidatePath("/finance");
  revalidatePath("/creative");
  revalidatePath("/");
}

// --- clients ---------------------------------------------------------------
// ⚠️ MOVED. `createClientRecord` / `updateClientRecord` lived here through
// Phase 5, when `clients` existed only so orders had a real foreign key. They
// now live in `actions/clients.ts` alongside the rest of the CRM — one
// implementation, so the field trimming cannot drift between two copies. Same
// reasoning as lifting `syncTransaction()` into `actions/finance-link.ts`.

// --- orders ----------------------------------------------------------------

export type OrderLineInput = {
  productId: string | null;
  description: string;
  quantity: number;
  /** Decimal lira as typed; converted to kuruş here and nowhere else. */
  unitPrice: number | null;
};

export type OrderInput = {
  code: string | null;
  clientId: string | null;
  title: string;
  notes: string | null;
  promisedOn: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippingCost: number | null;
  lines: OrderLineInput[];
};

function orderRow(input: OrderInput, totalMinor: number) {
  return {
    code: input.code?.trim().slice(0, 40) || null,
    client_id: input.clientId,
    title: input.title.trim().slice(0, 200) || "Untitled order",
    notes: input.notes?.trim().slice(0, 4000) || null,
    total_minor: totalMinor,
    promised_on: input.promisedOn,
    carrier: input.carrier?.trim().slice(0, 80) || null,
    tracking_number: input.trackingNumber?.trim().slice(0, 120) || null,
    shipping_cost_minor:
      input.shippingCost == null ? null : Math.abs(toMinor(input.shippingCost)),
  };
}

/**
 * ⚠️ The total is DERIVED from the lines, never typed separately. Two places to
 * enter the same number is two numbers that disagree — and the one people would
 * trust is the one that isn't itemised.
 */
function totalFromLines(lines: OrderLineInput[]): number {
  return lines.reduce((sum, line) => {
    const price = line.unitPrice == null ? 0 : Math.abs(toMinor(line.unitPrice));
    return sum + Math.max(1, Math.round(line.quantity || 1)) * price;
  }, 0);
}

async function writeLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  lines: OrderLineInput[]
) {
  // Replace wholesale: the editor sends the full set, and diffing rows the user
  // can reorder buys nothing over a delete + insert inside one action.
  await supabase.from("order_lines").delete().eq("order_id", orderId);
  const rows = lines
    .filter((line) => line.description.trim() || line.productId)
    .map((line, index) => ({
      order_id: orderId,
      product_id: line.productId,
      // Denormalised so the line still reads if the product is later deleted.
      description: line.description.trim().slice(0, 200),
      quantity: Math.max(1, Math.round(line.quantity || 1)),
      unit_price_minor:
        line.unitPrice == null ? 0 : Math.abs(toMinor(line.unitPrice)),
      sort_order: index,
    }));
  if (rows.length) await supabase.from("order_lines").insert(rows);
}

export async function createOrder(
  input: OrderInput
): Promise<ActionResult<Order>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      ...orderRow(input, totalFromLines(input.lines)),
      created_by: ctx.userId,
    })
    .select()
    .single<Order>();

  if (error) return { ok: false, error: error.message };

  await writeLines(supabase, data.id, input.lines);

  // ⚠️ The opening stage is logged like any other, so cycle-time has a start.
  // Without this row, the time spent in 'enquiry' is unmeasurable.
  await supabase.from("order_stage_events").insert({
    order_id: data.id,
    stage: data.stage,
    created_by: ctx.userId,
  });

  refresh();
  return { ok: true, data };
}

export async function updateOrder(
  id: string,
  input: OrderInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update(orderRow(input, totalFromLines(input.lines)))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  await writeLines(supabase, id, input.lines);

  refresh(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ Deleting an order CASCADES to its lines, stage events and payment rows,
 * but leaves the Finance transactions standing — that money really was
 * received, and removing it would rewrite what a past month earned. The confirm
 * dialog says so. (Same rule as deleting a machine; see actions/equipment.ts.)
 */
export async function deleteOrder(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Move an order along the board.
 *
 * ⚠️ WRITES BOTH: the `stage` column (fast to query, drives the board) AND an
 * append-only `order_stage_events` row (the truth about WHEN). Updating only
 * the column loses the history silently and cycle-time quietly becomes wrong.
 *
 * Returns the outstanding balance when the order has just reached `delivered`,
 * so the client can offer to record the final payment — PRE-FILLED WITH WHAT IS
 * STILL OWED, not the total. That is what makes deposits safe: the deposit is
 * already subtracted before anyone sees the number.
 */
export async function setOrderStage(
  id: string,
  stage: OrderStage,
  note?: string
): Promise<ActionResult<{ outstandingMinor: number; justDelivered: boolean }>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const next = pick(stage, ORDER_STAGES, "enquiry");

  const { data: order } = await supabase
    .from("orders")
    .select("stage, total_minor")
    .eq("id", id)
    .maybeSingle<{ stage: OrderStage; total_minor: number }>();

  if (!order) return { ok: false, error: "That order no longer exists." };

  const { error } = await supabase.from("orders").update({ stage: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Only append when the stage actually changed — re-saving the same stage
  // would otherwise litter the timeline with zero-length spans.
  if (order.stage !== next) {
    await supabase.from("order_stage_events").insert({
      order_id: id,
      stage: next,
      note: note?.trim().slice(0, 200) || null,
      created_by: ctx.userId,
    });
  }

  const { data: payments } = await supabase
    .from("order_payments")
    .select("*")
    .eq("order_id", id);

  const outstanding = outstandingMinor(order, (payments ?? []) as OrderPayment[]);

  refresh(id);
  return {
    ok: true,
    data: {
      outstandingMinor: outstanding,
      justDelivered: next === "delivered" && order.stage !== "delivered",
    },
  };
}

// --- payments — THE FINANCE WRITER -----------------------------------------

export type PaymentInput = {
  orderId: string;
  /** Decimal lira. */
  amount: number;
  kind: PaymentKind;
  paidOn?: string;
  note?: string | null;
};

/**
 * ⚠️ THE MONEY. Each payment writes ONE Finance transaction tagged
 * `source_type:'order'`, so revenue is always read from `transactions` — never
 * from summing `orders.total_minor`, which is only what was AGREED and would
 * book unpaid quotes as income.
 *
 * A refund is written as an OUT transaction: `amount_minor` stays a positive
 * magnitude and the direction carries the sign, exactly as the ledger does.
 */
export async function recordPayment(
  input: PaymentInput
): Promise<ActionResult<OrderPayment>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const amountMinor = Math.abs(toMinor(input.amount));
  if (amountMinor <= 0) {
    return { ok: false, error: "A payment needs an amount." };
  }

  const kind = pick(input.kind, PAYMENT_KINDS, "balance");
  const paidOn = input.paidOn ?? todayInIstanbul();

  const { data: order } = await supabase
    .from("orders")
    .select("code, title")
    .eq("id", input.orderId)
    .maybeSingle<{ code: string | null; title: string }>();

  if (!order) return { ok: false, error: "That order no longer exists." };

  const label = order.code ? `${order.code} — ${order.title}` : order.title;
  const suffix =
    kind === "deposit" ? " (deposit)" : kind === "refund" ? " (refund)" : "";

  const transactionId = await syncTransaction(supabase, {
    existingTransactionId: null,
    amountMinor,
    direction: kind === "refund" ? "out" : "in",
    occurredOn: paidOn,
    description: `${label}${suffix}`.slice(0, 200),
    categoryName: "Sales",
    categoryKind: "income",
    sourceType: "order",
    sourceId: input.orderId,
    userId: ctx.userId,
  });

  const { data, error } = await supabase
    .from("order_payments")
    .insert({
      order_id: input.orderId,
      paid_on: paidOn,
      amount_minor: amountMinor,
      kind,
      transaction_id: transactionId,
      note: input.note?.trim().slice(0, 200) || null,
      created_by: ctx.userId,
    })
    .select()
    .single<OrderPayment>();

  if (error) {
    // Don't strand an income row for a payment that failed to save.
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
    return { ok: false, error: error.message };
  }

  refresh(input.orderId);
  return { ok: true, data };
}

/** Removing the payment removes its transaction — it had no other cause. */
export async function deletePayment(
  id: string,
  orderId: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("order_payments")
    .select("transaction_id")
    .eq("id", id)
    .maybeSingle<{ transaction_id: string | null }>();

  const { error } = await supabase.from("order_payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (existing?.transaction_id) {
    await supabase.from("transactions").delete().eq("id", existing.transaction_id);
  }

  refresh(orderId);
  return { ok: true, data: undefined };
}
