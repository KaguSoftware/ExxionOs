import type { createClient } from "@/lib/supabase/server";
import type { Direction } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * THE CROSS-SECTION FINANCE CONTRACT, IN ONE PLACE.
 *
 * ⚠️ This lived inside `actions/equipment.ts` until Phase 5, when Shipping
 * became its second writer. It was lifted here deliberately: it is the contract
 * every section honours, not one section's helper. Two copies would drift, and
 * the drift would be silent — the ledger would simply be wrong in one section.
 *
 * `transactions.source_type` / `source_id` (migration 0003) exist so every
 * figure in Finance can be traced back to what caused it: a repair, a restock,
 * a customer payment.
 */

/**
 * Find a Finance category by name, creating it if a fresh database lacks it.
 *
 * The seeds in migrations 0003 / 0008 provide Maintenance, Equipment and Sales,
 * but a database restored without seeds must still work rather than silently
 * filing money with no category.
 */
export async function categoryIdByName(
  supabase: Supa,
  name: string,
  kind: "income" | "expense" = "expense"
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("name", name)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("categories")
    .insert({ name, kind, sort_order: 40 })
    .select("id")
    .single<{ id: string }>();
  return created?.id ?? null;
}

/**
 * Keeps a Finance transaction in step with money recorded elsewhere in the app.
 *
 * The four cases, and why each is what it is:
 *  - amount set, no transaction yet    → CREATE one.
 *  - amount changed, transaction exists → UPDATE it.
 *  - amount CLEARED (null or ≤ 0)      → DELETE it. A ₺0 row is noise in the
 *    ledger, and leaving a stale one overstates what the shop spent or earned.
 *  - no amount, no transaction         → nothing.
 *
 * ⚠️ THE RETURNED ID IS THE ONLY LINK. The caller MUST store it, or the next
 * edit creates a second transaction instead of updating the first.
 *
 * ⚠️ `amountMinor` is a POSITIVE MAGNITUDE; `direction` carries the sign — the
 * same rule the transactions table itself follows. Never pass a negative.
 */
export async function syncTransaction(
  supabase: Supa,
  opts: {
    existingTransactionId: string | null;
    amountMinor: number | null;
    /** 'out' for costs, 'in' for revenue. Defaults to 'out'. */
    direction?: Direction;
    occurredOn: string;
    description: string;
    categoryName: string;
    /** 'income' when the category is being created for the first time. */
    categoryKind?: "income" | "expense";
    sourceType: string;
    sourceId: string;
    userId: string;
  }
): Promise<string | null> {
  const { existingTransactionId, amountMinor } = opts;
  const direction = opts.direction ?? "out";

  if (amountMinor == null || amountMinor <= 0) {
    if (existingTransactionId) {
      await supabase.from("transactions").delete().eq("id", existingTransactionId);
    }
    return null;
  }

  const categoryId = await categoryIdByName(
    supabase,
    opts.categoryName,
    opts.categoryKind ?? (direction === "in" ? "income" : "expense")
  );

  if (existingTransactionId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        occurred_on: opts.occurredOn,
        direction,
        amount_minor: amountMinor,
        description: opts.description,
        category_id: categoryId,
      })
      .eq("id", existingTransactionId);

    // If the transaction was deleted in Finance, the update matches nothing —
    // fall through and create a fresh one rather than losing the money.
    if (!error) return existingTransactionId;
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      occurred_on: opts.occurredOn,
      direction,
      amount_minor: amountMinor,
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
