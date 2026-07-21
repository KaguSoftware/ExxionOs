"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { toMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Machine,
  MachineStatus,
  MaintenanceKind,
  MaintenanceLog,
  Supply,
} from "@/lib/types";
import { MACHINE_STATUSES, MAINTENANCE_KINDS } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

type Supa = Awaited<ReturnType<typeof createClient>>;

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refresh(machineId?: string) {
  revalidatePath("/equipment");
  if (machineId) revalidatePath(`/equipment/machines/${machineId}`);
  // The linked expense lands in Finance and in the dashboard totals.
  revalidatePath("/finance");
  revalidatePath("/");
}

/**
 * Find a Finance category by name, creating it if a fresh database lacks it.
 *
 * The seed in migration 0003 provides "Maintenance" and "Equipment", but a
 * database restored without the seed must still work rather than silently
 * filing expenses with no category.
 */
async function categoryIdByName(supabase: Supa, name: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("name", name)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("categories")
    .insert({ name, kind: "expense", sort_order: 40 })
    .select("id")
    .single<{ id: string }>();
  return created?.id ?? null;
}

/**
 * ⚠️ THE CONTRACT, IN ONE FUNCTION.
 *
 * Keeps a Finance transaction in step with a cost recorded elsewhere in the
 * app. This is what `transactions.source_type` / `source_id` (migration 0003)
 * was built for — Equipment is its first real writer.
 *
 * The four cases, and why each is what it is:
 *  - cost set, no transaction yet  → CREATE one.
 *  - cost changed, transaction exists → UPDATE it.
 *  - cost CLEARED → DELETE it. An expense of ₺0 is noise in the ledger, and
 *    leaving a stale one would overstate what the shop spent.
 *  - no cost, no transaction → nothing.
 *
 * ⚠️ The returned id is the ONLY link. The caller must store it, or the next
 * edit will create a second transaction instead of updating the first.
 */
async function syncTransaction(
  supabase: Supa,
  opts: {
    existingTransactionId: string | null;
    costMinor: number | null;
    occurredOn: string;
    description: string;
    categoryName: string;
    sourceType: string;
    sourceId: string;
    userId: string;
  }
): Promise<string | null> {
  const { existingTransactionId, costMinor } = opts;

  if (costMinor == null || costMinor <= 0) {
    if (existingTransactionId) {
      await supabase.from("transactions").delete().eq("id", existingTransactionId);
    }
    return null;
  }

  const categoryId = await categoryIdByName(supabase, opts.categoryName);

  if (existingTransactionId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        occurred_on: opts.occurredOn,
        amount_minor: costMinor,
        description: opts.description,
        category_id: categoryId,
      })
      .eq("id", existingTransactionId);

    // If the transaction was deleted in Finance, the update matches nothing —
    // fall through and create a fresh one rather than losing the expense.
    if (!error) return existingTransactionId;
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      occurred_on: opts.occurredOn,
      direction: "out",
      amount_minor: costMinor,
      description: opts.description,
      category_id: categoryId,
      source_type: opts.sourceType,
      source_id: opts.sourceId,
      created_by: opts.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return null;
  return data.id;
}

// --- machines --------------------------------------------------------------

export type MachineInput = {
  name: string;
  kind: string | null;
  model: string | null;
  serial: string | null;
  status: MachineStatus;
  location: string | null;
  purchasedOn: string | null;
  /** Decimal lira as typed; converted to kuruş here and nowhere else. */
  purchasePrice: number | null;
  /**
   * ⚠️ OPT-IN, and off by default. Most machines are entered long after they
   * were bought and were already expensed at the time — logging automatically
   * would double-count. When true, the expense is dated to `purchasedOn`, not
   * to today, so the right month is charged.
   */
  logPurchaseExpense?: boolean;
  notes: string | null;
};

function machineRow(input: MachineInput) {
  return {
    name: input.name.trim().slice(0, 120) || "Untitled machine",
    kind: input.kind?.trim().slice(0, 60) || null,
    model: input.model?.trim().slice(0, 120) || null,
    serial: input.serial?.trim().slice(0, 120) || null,
    status: pick(input.status, MACHINE_STATUSES, "operational"),
    location: input.location?.trim().slice(0, 120) || null,
    purchased_on: input.purchasedOn,
    purchase_price_minor:
      input.purchasePrice == null ? null : Math.abs(toMinor(input.purchasePrice)),
    notes: input.notes?.trim().slice(0, 4000) || null,
  };
}

export async function createMachine(
  input: MachineInput
): Promise<ActionResult<Machine>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("machines")
    .insert(machineRow(input))
    .select()
    .single<Machine>();

  if (error) return { ok: false, error: error.message };

  // Only when explicitly asked for — see MachineInput.logPurchaseExpense.
  if (input.logPurchaseExpense && input.purchasePrice) {
    const transactionId = await syncTransaction(supabase, {
      existingTransactionId: null,
      costMinor: Math.abs(toMinor(input.purchasePrice)),
      // ⚠️ The PURCHASE date, not today: a machine bought in March and entered
      // in July must charge March, or both months read wrong.
      occurredOn: input.purchasedOn ?? todayInIstanbul(),
      description: `${data.name} — purchase`,
      categoryName: "Equipment",
      sourceType: "equipment",
      sourceId: data.id,
      userId: ctx.userId,
    });
    if (transactionId) {
      await supabase
        .from("machines")
        .update({ purchase_transaction_id: transactionId })
        .eq("id", data.id);
    }
  }

  refresh();
  return { ok: true, data };
}

export async function updateMachine(
  id: string,
  input: MachineInput
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("machines")
    .select("purchase_transaction_id")
    .eq("id", id)
    .maybeSingle<{ purchase_transaction_id: string | null }>();

  const { error } = await supabase.from("machines").update(machineRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Keep an EXISTING purchase expense in step with the price, and honour the
  // checkbox being newly ticked or cleared. A machine with no linked expense
  // and the box unticked stays untouched — that is the common case.
  if (existing?.purchase_transaction_id || input.logPurchaseExpense) {
    const transactionId = await syncTransaction(supabase, {
      existingTransactionId: existing?.purchase_transaction_id ?? null,
      costMinor:
        input.logPurchaseExpense && input.purchasePrice
          ? Math.abs(toMinor(input.purchasePrice))
          : null,
      occurredOn: input.purchasedOn ?? todayInIstanbul(),
      description: `${input.name.trim() || "Machine"} — purchase`,
      categoryName: "Equipment",
      sourceType: "equipment",
      sourceId: id,
      userId: ctx.userId,
    });
    await supabase
      .from("machines")
      .update({ purchase_transaction_id: transactionId })
      .eq("id", id);
  }

  refresh(id);
  return { ok: true, data: undefined };
}

/** Inline status change from the machine card — the "mark it broken" action. */
export async function setMachineStatus(
  id: string,
  status: MachineStatus
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("machines")
    .update({ status: pick(status, MACHINE_STATUSES, "operational") })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ Deleting a machine CASCADES to its maintenance logs but leaves their
 * Finance transactions standing — that money really was spent, and removing it
 * would rewrite history. The confirm dialog says so.
 */
export async function deleteMachine(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("machines").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

// --- maintenance -----------------------------------------------------------

export type MaintenanceInput = {
  machineId: string;
  performedOn: string;
  kind: MaintenanceKind;
  description: string;
  /** Decimal lira. Null = it cost nothing, which is a real outcome. */
  cost: number | null;
};

export async function createMaintenance(
  input: MaintenanceInput
): Promise<ActionResult<MaintenanceLog>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: machine } = await supabase
    .from("machines")
    .select("name")
    .eq("id", input.machineId)
    .maybeSingle<{ name: string }>();

  const costMinor = input.cost == null ? null : Math.abs(toMinor(input.cost));
  const description = input.description.trim().slice(0, 200);

  const transactionId = await syncTransaction(supabase, {
    existingTransactionId: null,
    costMinor,
    occurredOn: input.performedOn,
    // Names the machine, so the Finance row reads on its own without needing
    // to follow the link back.
    description: `${description || "Maintenance"} — ${machine?.name ?? "machine"}`,
    categoryName: "Maintenance",
    sourceType: "equipment",
    sourceId: input.machineId,
    userId: ctx.userId,
  });

  const { data, error } = await supabase
    .from("maintenance_logs")
    .insert({
      machine_id: input.machineId,
      performed_on: input.performedOn,
      kind: pick(input.kind, MAINTENANCE_KINDS, "repair"),
      description,
      cost_minor: costMinor,
      transaction_id: transactionId,
      performed_by: ctx.userId,
    })
    .select()
    .single<MaintenanceLog>();

  if (error) {
    // Don't strand an expense for a log that failed to save.
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
    return { ok: false, error: error.message };
  }

  refresh(input.machineId);
  return { ok: true, data };
}

export async function updateMaintenance(
  id: string,
  input: MaintenanceInput
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("maintenance_logs")
    .select("transaction_id")
    .eq("id", id)
    .maybeSingle<{ transaction_id: string | null }>();

  const { data: machine } = await supabase
    .from("machines")
    .select("name")
    .eq("id", input.machineId)
    .maybeSingle<{ name: string }>();

  const costMinor = input.cost == null ? null : Math.abs(toMinor(input.cost));
  const description = input.description.trim().slice(0, 200);

  const transactionId = await syncTransaction(supabase, {
    existingTransactionId: existing?.transaction_id ?? null,
    costMinor,
    occurredOn: input.performedOn,
    description: `${description || "Maintenance"} — ${machine?.name ?? "machine"}`,
    categoryName: "Maintenance",
    sourceType: "equipment",
    sourceId: input.machineId,
    userId: ctx.userId,
  });

  const { error } = await supabase
    .from("maintenance_logs")
    .update({
      performed_on: input.performedOn,
      kind: pick(input.kind, MAINTENANCE_KINDS, "repair"),
      description,
      cost_minor: costMinor,
      transaction_id: transactionId,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(input.machineId);
  return { ok: true, data: undefined };
}

/** Removing the log removes its expense — that expense had no other cause. */
export async function deleteMaintenance(
  id: string,
  machineId: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("maintenance_logs")
    .select("transaction_id")
    .eq("id", id)
    .maybeSingle<{ transaction_id: string | null }>();

  const { error } = await supabase.from("maintenance_logs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (existing?.transaction_id) {
    await supabase.from("transactions").delete().eq("id", existing.transaction_id);
  }

  refresh(machineId);
  return { ok: true, data: undefined };
}

// --- supplies --------------------------------------------------------------

export type SupplyInput = {
  name: string;
  unit: string;
  quantity: number | null;
  lowThreshold: number | null;
  notes: string | null;
};

export async function createSupply(
  input: SupplyInput
): Promise<ActionResult<Supply>> {
  await getSessionContext();
  const supabase = await createClient();

  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "A supply needs a name." };

  const { data, error } = await supabase
    .from("supplies")
    .insert({
      name,
      unit: input.unit.trim().slice(0, 20) || "pcs",
      quantity: input.quantity ?? 0,
      low_threshold: input.lowThreshold,
      notes: input.notes?.trim().slice(0, 2000) || null,
    })
    .select()
    .single<Supply>();

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data };
}

export async function updateSupply(
  id: string,
  input: SupplyInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "A supply needs a name." };

  const { error } = await supabase
    .from("supplies")
    .update({
      name,
      unit: input.unit.trim().slice(0, 20) || "pcs",
      quantity: input.quantity ?? 0,
      low_threshold: input.lowThreshold,
      notes: input.notes?.trim().slice(0, 2000) || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

/** Adjust stock without a purchase — a count correction, or usage. */
export async function adjustSupplyQuantity(
  id: string,
  quantity: number
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("supplies")
    .update({ quantity: Math.max(0, quantity) })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Restock: adds stock AND (when it cost something) writes the Finance expense,
 * tagged `source_type:'supply'`.
 */
export async function restockSupply(input: {
  supplyId: string;
  quantity: number;
  cost: number | null;
  restockedOn?: string;
}): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: supply } = await supabase
    .from("supplies")
    .select("name, quantity")
    .eq("id", input.supplyId)
    .maybeSingle<{ name: string; quantity: string | number }>();

  if (!supply) return { ok: false, error: "That supply no longer exists." };

  const restockedOn = input.restockedOn ?? todayInIstanbul();
  const costMinor = input.cost == null ? null : Math.abs(toMinor(input.cost));

  const transactionId = await syncTransaction(supabase, {
    existingTransactionId: null,
    costMinor,
    occurredOn: restockedOn,
    description: `${supply.name} restock`,
    categoryName: "Equipment",
    sourceType: "supply",
    sourceId: input.supplyId,
    userId: ctx.userId,
  });

  const { error: restockError } = await supabase.from("supply_restocks").insert({
    supply_id: input.supplyId,
    restocked_on: restockedOn,
    quantity: input.quantity,
    cost_minor: costMinor,
    transaction_id: transactionId,
    created_by: ctx.userId,
  });

  if (restockError) {
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
    return { ok: false, error: restockError.message };
  }

  const current = Number(supply.quantity) || 0;
  const { error } = await supabase
    .from("supplies")
    .update({
      quantity: current + input.quantity,
      // Remember what it cost last time, so the next restock can pre-fill.
      ...(costMinor != null ? { last_price_minor: costMinor } : {}),
    })
    .eq("id", input.supplyId);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

/** ⚠️ Archive, never delete — restock history references it. */
export async function archiveSupply(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("supplies")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}
