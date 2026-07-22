"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { toMinor } from "@/lib/money";
import { appendMovement } from "@/lib/stock-write";
import { createClient } from "@/lib/supabase/server";
import { todayInIstanbul } from "@/lib/utils";
import type {
  ActionResult,
  Collection,
  CollectionStatus,
  Idea,
  IdeaStatus,
  Issue,
  PrintOutcome,
  Product,
  Severity,
} from "@/lib/types";
import {
  COLLECTION_STATUSES,
  IDEA_STATUSES,
  PRINT_OUTCOMES,
  SEVERITIES,
} from "@/lib/types";

/** Never trust a client string to be one of a fixed set. */
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refreshCreative(collectionId?: string) {
  revalidatePath("/creative");
  if (collectionId) revalidatePath(`/creative/collections/${collectionId}`);
  revalidatePath("/");
}

// --- collections -----------------------------------------------------------

export async function createCollection(input: {
  name: string;
  description: string | null;
  status: CollectionStatus;
  startedOn: string | null;
}): Promise<ActionResult<Collection>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collections")
    .insert({
      name: input.name.trim().slice(0, 120) || "Untitled collection",
      description: input.description?.trim().slice(0, 4000) || null,
      status: pick(input.status, COLLECTION_STATUSES, "planned"),
      started_on: input.startedOn,
      created_by: ctx.userId,
    })
    .select()
    .single<Collection>();

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data };
}

export async function updateCollection(
  id: string,
  input: {
    name: string;
    description: string | null;
    status: CollectionStatus;
    startedOn: string | null;
  }
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("collections")
    .update({
      name: input.name.trim().slice(0, 120) || "Untitled collection",
      description: input.description?.trim().slice(0, 4000) || null,
      status: pick(input.status, COLLECTION_STATUSES, "planned"),
      started_on: input.startedOn,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshCreative(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ Deleting a collection CASCADES to its products but only NULLS the links
 * on its issues — those survive as learnings. The confirm dialog says so; see
 * migration 0004 for why.
 */
export async function deleteCollection(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data: undefined };
}

// --- ideas -----------------------------------------------------------------

export async function createIdea(input: {
  title: string;
  body: string | null;
}): Promise<ActionResult<Idea>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title: input.title.trim().slice(0, 200) || "Untitled idea",
      body: input.body?.trim().slice(0, 4000) || null,
      created_by: ctx.userId,
    })
    .select()
    .single<Idea>();

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data };
}

/** Edit an idea's title and body. Status is changed separately (a one-click
 *  control on each row), so it is untouched here. */
export async function updateIdea(
  id: string,
  input: { title: string; body: string | null }
): Promise<ActionResult<Idea>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ideas")
    .update({
      title: input.title.trim().slice(0, 200) || "Untitled idea",
      body: input.body?.trim().slice(0, 4000) || null,
    })
    .eq("id", id)
    .select()
    .single<Idea>();

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data };
}

export async function updateIdeaStatus(
  id: string,
  status: IdeaStatus
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("ideas")
    .update({ status: pick(status, IDEA_STATUSES, "new") })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data: undefined };
}

export async function deleteIdea(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data: undefined };
}

/**
 * "Make it" — turn an idea into a collection.
 *
 * The idea keeps its row and gains `collection_id`, so you can always see which
 * collections began as ideas. It is NOT deleted or moved: an idea and the
 * collection it became are two different records of two different moments.
 */
export async function promoteIdea(
  id: string
): Promise<ActionResult<{ collectionId: string }>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: idea, error: readError } = await supabase
    .from("ideas")
    .select("*")
    .eq("id", id)
    .maybeSingle<Idea>();

  if (readError) return { ok: false, error: readError.message };
  if (!idea) return { ok: false, error: "That idea no longer exists." };
  if (idea.collection_id) {
    // Already promoted — return the existing collection rather than minting a
    // second one, so a double-click can't create duplicates.
    return { ok: true, data: { collectionId: idea.collection_id } };
  }

  const { data: collection, error: createError } = await supabase
    .from("collections")
    .insert({
      name: idea.title,
      description: idea.body,
      status: "planned",
      created_by: ctx.userId,
    })
    .select()
    .single<Collection>();

  if (createError) return { ok: false, error: createError.message };

  const { error: linkError } = await supabase
    .from("ideas")
    .update({ collection_id: collection.id, status: "made" })
    .eq("id", id);

  if (linkError) return { ok: false, error: linkError.message };

  refreshCreative();
  return { ok: true, data: { collectionId: collection.id } };
}

// --- products --------------------------------------------------------------

export type ProductInput = {
  collectionId: string;
  name: string;
  kind: string | null;
  /** The supply printed from — its cost_per_kg_minor costs this product. */
  supplyId: string | null;
  /** Grams of material. Null when unknown — see costing.ts. */
  grams: number | null;
  printHours: number | null;
  /** Decimal lira as typed; converted to kuruş here and nowhere else. */
  price: number | null;
  notes: string | null;
};

function productRow(input: ProductInput) {
  return {
    collection_id: input.collectionId,
    name: input.name.trim().slice(0, 120) || "Untitled product",
    kind: input.kind?.trim().slice(0, 60) || null,
    supply_id: input.supplyId,
    grams: input.grams,
    print_hours: input.printHours,
    // ⚠️ The ONE conversion point for this table. Null stays null — an unpriced
    // product must not become ₺0,00, which reads as "free".
    price_minor: input.price == null ? null : Math.abs(toMinor(input.price)),
    notes: input.notes?.trim().slice(0, 4000) || null,
  };
}

export async function createProduct(
  input: ProductInput
): Promise<ActionResult<Product>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert(productRow(input))
    .select()
    .single<Product>();

  if (error) return { ok: false, error: error.message };
  refreshCreative(input.collectionId);
  return { ok: true, data };
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("products").update(productRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshCreative(input.collectionId);
  return { ok: true, data: undefined };
}

export async function deleteProduct(
  id: string,
  collectionId: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshCreative(collectionId);
  return { ok: true, data: undefined };
}

// --- issues (the Learnings spine) ------------------------------------------

export type IssueInput = {
  title: string;
  body: string | null;
  collectionId: string | null;
  productId: string | null;
  severity: Severity;
};

export async function createIssue(input: IssueInput): Promise<ActionResult<Issue>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issues")
    .insert({
      title: input.title.trim().slice(0, 200) || "Untitled issue",
      body: input.body?.trim().slice(0, 4000) || null,
      collection_id: input.collectionId,
      product_id: input.productId,
      severity: pick(input.severity, SEVERITIES, "medium"),
      created_by: ctx.userId,
    })
    .select()
    .single<Issue>();

  if (error) return { ok: false, error: error.message };
  refreshCreative(input.collectionId ?? undefined);
  return { ok: true, data };
}

export async function updateIssue(
  id: string,
  input: IssueInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("issues")
    .update({
      title: input.title.trim().slice(0, 200) || "Untitled issue",
      body: input.body?.trim().slice(0, 4000) || null,
      collection_id: input.collectionId,
      product_id: input.productId,
      severity: pick(input.severity, SEVERITIES, "medium"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshCreative(input.collectionId ?? undefined);
  return { ok: true, data: undefined };
}

/**
 * Answering "how did we fix it" IS marking the issue solved.
 *
 * ⚠️ There is no separate "solved" toggle, deliberately: a flag and a written
 * fix would drift, and an issue marked solved with no explanation teaches
 * nobody — which is the one thing this section exists to prevent. Clearing the
 * text re-opens the issue, because an issue whose fix was deleted is, honestly,
 * unsolved again.
 */
export async function resolveIssue(
  id: string,
  resolution: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const text = resolution.trim().slice(0, 4000);

  const { error } = await supabase
    .from("issues")
    .update({
      resolution: text || null,
      resolved_at: text ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data: undefined };
}

export async function deleteIssue(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("issues").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data: undefined };
}

// --- print runs (filament stock) -------------------------------------------

/**
 * Record that you printed N of something, and deduct the filament.
 *
 * ⚠️ STOCK IS DEDUCTED HERE, NOT WHEN THE PRODUCT IS CREATED. A product is a
 * DESIGN; creating it consumes nothing. Printing it is the real-world event, so
 * this is the honest place to touch stock. Deducting at design time would
 * charge one unit for something you print fifty times.
 *
 * The deduction only happens when the product points at a supply
 * (`products.supply_id`) — a product with no supply set has no stock to draw
 * down, and silently inventing one would be worse than tracking nothing.
 */
export async function recordPrintRun(input: {
  productId: string;
  units: number;
  outcome?: PrintOutcome;
  printedOn?: string;
  notes?: string | null;
}): Promise<
  ActionResult<{
    gramsUsed: number | null;
    supplyName: string | null;
    unitsAdded: number;
  }>
> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const units = Math.max(1, Math.round(input.units));
  const outcome = pick(input.outcome, PRINT_OUTCOMES, "good");

  const { data: product } = await supabase
    .from("products")
    .select("id, collection_id, grams, supply_id")
    .eq("id", input.productId)
    .maybeSingle<{
      id: string;
      collection_id: string;
      grams: string | number | null;
      supply_id: string | null;
    }>();

  if (!product) return { ok: false, error: "That product no longer exists." };

  // The product points straight at the supply it's printed from. The link may
  // be absent, and that's fine: the run is still recorded, just no deduction.
  let supply: { id: string; name: string; quantity: string | number } | null = null;
  if (product.supply_id) {
    const { data } = await supabase
      .from("supplies")
      .select("id, name, quantity")
      .eq("id", product.supply_id)
      .maybeSingle<{ id: string; name: string; quantity: string | number }>();
    supply = data ?? null;
  }

  // `numeric` arrives as a string over PostgREST.
  const gramsEach = Number(product.grams);
  const gramsUsed =
    Number.isFinite(gramsEach) && gramsEach > 0 ? gramsEach * units : null;

  const { data: run, error: runError } = await supabase
    .from("print_runs")
    .insert({
      product_id: product.id,
      printed_on: input.printedOn ?? todayInIstanbul(),
      units,
      outcome,
      grams_used: gramsUsed,
      supply_id: supply?.id ?? null,
      notes: input.notes?.trim().slice(0, 500) || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (runError) return { ok: false, error: runError.message };

  // ⚠️ ONLY A GOOD RUN ADDS SELLABLE UNITS. A test or failed print still
  // deducts filament below — it burned real material — but nothing came off
  // the plate that anyone can ship. Counting failures as stock is the error
  // that makes you promise an order against plastic that does not exist.
  const unitsAdded = outcome === "good" ? units : 0;
  if (unitsAdded > 0) {
    const movement = await appendMovement(supabase, ctx.userId, {
      productId: product.id,
      delta: unitsAdded,
      reason: "print_run",
      sourceId: run.id,
    });
    if (!movement.ok) return { ok: false, error: movement.error };
  }

  if (supply && gramsUsed != null) {
    const current = Number(supply.quantity) || 0;
    // ⚠️ Filament STOCK is kept in KILOGRAMS, but a print burns GRAMS. Convert
    // here (grams → kg) before subtracting, or a run would wipe the whole spool.
    // `grams_used` itself stays in grams — it's a physical record of the print.
    const kgUsed = gramsUsed / 1000;
    // Floor at zero: stock cannot be negative, and a negative reading would
    // just be a confusing way of saying "you ran out and kept going".
    const next = Math.max(0, current - kgUsed);
    const { error } = await supabase
      .from("supplies")
      .update({ quantity: next })
      .eq("id", supply.id);
    if (error) return { ok: false, error: error.message };
  }

  refreshCreative(product.collection_id);
  revalidatePath("/equipment");
  return {
    ok: true,
    data: { gramsUsed, supplyName: supply?.name ?? null, unitsAdded },
  };
}

/** Undo a print run: put the filament back, and take the units away again. */
export async function deletePrintRun(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("print_runs")
    .select("grams_used, supply_id, product_id, outcome, units")
    .eq("id", id)
    .maybeSingle<{
      grams_used: string | number | null;
      supply_id: string | null;
      product_id: string;
      outcome: PrintOutcome;
      units: number;
    }>();

  // ⚠️ REMOVE THE UNITS BEFORE DELETING THE RUN. The movement's `source_id`
  // points at this run, and reading it after the delete would leave phantom
  // stock — units on the shelf that no print run explains.
  //
  // Written as its own NEGATIVE row rather than deleting the original, because
  // the ledger is append-only: "printed 5, then un-logged it" is the truth, and
  // erasing the first row would claim the print never happened.
  if (run && run.outcome === "good" && run.units > 0) {
    const reversal = await appendMovement(supabase, ctx.userId, {
      productId: run.product_id,
      delta: -run.units,
      reason: "print_run",
      sourceId: id,
    });
    if (!reversal.ok) return { ok: false, error: reversal.error };
  }

  const { error } = await supabase.from("print_runs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Restore stock from the SNAPSHOT on the run, not from the product's current
  // grams — the design may have been edited since, and putting back a
  // different amount than was taken would corrupt the count.
  if (run?.supply_id && run.grams_used != null) {
    const { data: supply } = await supabase
      .from("supplies")
      .select("quantity")
      .eq("id", run.supply_id)
      .maybeSingle<{ quantity: string | number }>();
    if (supply) {
      // Stock is in kg; the snapshot is in grams — convert before adding back.
      const kgUsed = Number(run.grams_used) / 1000;
      await supabase
        .from("supplies")
        .update({ quantity: (Number(supply.quantity) || 0) + kgUsed })
        .eq("id", run.supply_id);
    }
  }

  refreshCreative();
  revalidatePath("/equipment");
  return { ok: true, data: undefined };
}

// --- costing settings ------------------------------------------------------
// ⚠️ The per-kg material cost moved onto SUPPLIES (Equipment). The only costing
// setting left here is the machine hourly rate.

export async function updateMachineRate(rate: number): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("app_settings")
    .update({ machine_hour_rate_minor: Math.abs(toMinor(rate || 0)) })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  refreshCreative();
  return { ok: true, data: undefined };
}

// --- images ----------------------------------------------------------------

export async function attachImage(input: {
  parent: "product" | "issue";
  parentId: string;
  path: string;
}): Promise<ActionResult<{ id: string }>> {
  await getSessionContext();
  const supabase = await createClient();

  const table = input.parent === "product" ? "product_images" : "issue_images";
  const column = input.parent === "product" ? "product_id" : "issue_id";

  const { data, error } = await supabase
    .from(table)
    .insert({ [column]: input.parentId, path: input.path })
    .select("id")
    .single<{ id: string }>();

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data };
}

export async function detachImage(
  parent: "product" | "issue",
  id: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const table = parent === "product" ? "product_images" : "issue_images";

  const { data: row } = await supabase
    .from(table)
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string }>();

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Remove the file too, or the bucket accumulates orphans nobody can reach.
  if (row?.path) await supabase.storage.from("creative").remove([row.path]);

  refreshCreative();
  return { ok: true, data: undefined };
}

// --- product files (.mb / .ma / .stl) --------------------------------------

/**
 * Record a source file already uploaded to the `creative` bucket (the upload
 * itself goes browser → bucket, like photos; only the path reaches here).
 * Returns the new row so the client can render it without a refetch.
 */
export async function attachProductFile(input: {
  productId: string;
  path: string;
  name: string;
  sizeBytes: number | null;
}): Promise<ActionResult<{ id: string; created_at: string }>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_files")
    .insert({
      product_id: input.productId,
      path: input.path,
      name: input.name.slice(0, 255),
      size_bytes: input.sizeBytes,
      created_by: ctx.userId,
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (error) return { ok: false, error: error.message };
  refreshCreative();
  return { ok: true, data };
}

export async function detachProductFile(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("product_files")
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string }>();

  const { error } = await supabase.from("product_files").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Remove the file too, or the bucket accumulates orphans nobody can reach.
  if (row?.path) await supabase.storage.from("creative").remove([row.path]);

  refreshCreative();
  return { ok: true, data: undefined };
}
