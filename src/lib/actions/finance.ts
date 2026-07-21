"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { toMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Cadence,
  Category,
  Direction,
  RecurringItem,
  Transaction,
} from "@/lib/types";

const DIRECTIONS: Direction[] = ["in", "out"];
const CADENCE_VALUES: Cadence[] = ["monthly", "quarterly", "yearly"];

/** Never trust a string from the client to be one of a fixed set. */
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refresh() {
  revalidatePath("/finance");
  revalidatePath("/");
}

// --- transactions ----------------------------------------------------------

export type TransactionInput = {
  occurredOn: string;
  direction: Direction;
  /** Decimal lira, as typed. Converted to kuruş HERE and nowhere else. */
  amount: number;
  description: string;
  categoryId: string | null;
  note: string | null;
  receiptPath: string | null;
};

export async function createTransaction(
  input: TransactionInput
): Promise<ActionResult<Transaction>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      occurred_on: input.occurredOn,
      direction: pick(input.direction, DIRECTIONS, "out"),
      // ⚠️ THE ONLY CONVERSION POINT. Everything downstream is kuruş.
      // Math.abs because the sign lives in `direction`; a negative here would
      // violate the CHECK constraint and, worse, be a second source of truth.
      amount_minor: Math.abs(toMinor(input.amount)),
      description: input.description.trim().slice(0, 200),
      category_id: input.categoryId,
      note: input.note?.trim().slice(0, 2000) || null,
      receipt_path: input.receiptPath,
      created_by: ctx.userId,
    })
    .select()
    .single<Transaction>();

  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, data };
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<ActionResult<Transaction>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .update({
      occurred_on: input.occurredOn,
      direction: pick(input.direction, DIRECTIONS, "out"),
      amount_minor: Math.abs(toMinor(input.amount)),
      description: input.description.trim().slice(0, 200),
      category_id: input.categoryId,
      note: input.note?.trim().slice(0, 2000) || null,
      receipt_path: input.receiptPath,
    })
    .eq("id", id)
    .select()
    .single<Transaction>();

  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, data };
}

/**
 * ⚠️ Deleting a transaction that carries a `source_id` removes only the
 * FINANCIAL RECORD — the equipment repair or shipment that caused it still
 * exists, and could regenerate this row. The UI must say so before confirming;
 * see the delete confirm in `transaction-row.tsx`.
 */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  // Clean up the receipt too, or the bucket accumulates orphans nobody can
  // reach. Best-effort: a missing file must not block the delete.
  const { data: row } = await supabase
    .from("transactions")
    .select("receipt_path")
    .eq("id", id)
    .maybeSingle<{ receipt_path: string | null }>();

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (row?.receipt_path) {
    await supabase.storage.from("receipts").remove([row.receipt_path]);
  }

  refresh();
  return { ok: true, data: undefined };
}

// --- categories ------------------------------------------------------------

export async function createCategory(input: {
  name: string;
  kind: "income" | "expense";
}): Promise<ActionResult<Category>> {
  await getSessionContext();
  const supabase = await createClient();

  const name = input.name.trim().slice(0, 60);
  if (!name) return { ok: false, error: "A category needs a name." };

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      kind: pick(input.kind, ["income", "expense"], "expense"),
      sort_order: 50,
    })
    .select()
    .single<Category>();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/categories");
  refresh();
  return { ok: true, data };
}

export async function updateCategory(
  id: string,
  name: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { ok: false, error: "A category needs a name." };

  const { error } = await supabase
    .from("categories")
    .update({ name: trimmed })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/categories");
  refresh();
  return { ok: true, data: undefined };
}

/**
 * ⚠️ ARCHIVE, NEVER DELETE. A deleted category would null out `category_id` on
 * every historical transaction that used it, silently changing what past
 * months were spent on. Archiving removes it from pickers and leaves the
 * history it explains intact.
 */
export async function archiveCategory(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/categories");
  refresh();
  return { ok: true, data: undefined };
}

// --- recurring -------------------------------------------------------------

export type RecurringInput = {
  label: string;
  direction: Direction;
  amount: number;
  categoryId: string | null;
  cadence: Cadence;
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
};

export async function createRecurring(
  input: RecurringInput
): Promise<ActionResult<RecurringItem>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_items")
    .insert(recurringRow(input))
    .select()
    .single<RecurringItem>();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/recurring");
  refresh();
  return { ok: true, data };
}

export async function updateRecurring(
  id: string,
  input: RecurringInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_items")
    .update(recurringRow(input))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/recurring");
  refresh();
  return { ok: true, data: undefined };
}

export async function toggleRecurring(
  id: string,
  active: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_items")
    .update({ active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/recurring");
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Deletes the TEMPLATE only. Transactions it already produced stay, with their
 * `recurring_id` set to null by the FK — those months genuinely happened and
 * removing them would rewrite history.
 */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance/recurring");
  refresh();
  return { ok: true, data: undefined };
}

function recurringRow(input: RecurringInput) {
  return {
    label: input.label.trim().slice(0, 120) || "Untitled",
    direction: pick(input.direction, DIRECTIONS, "out"),
    amount_minor: Math.abs(toMinor(input.amount)),
    category_id: input.categoryId,
    cadence: pick(input.cadence, CADENCE_VALUES, "monthly"),
    day_of_month: Math.min(31, Math.max(1, Math.round(input.dayOfMonth) || 1)),
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  };
}
