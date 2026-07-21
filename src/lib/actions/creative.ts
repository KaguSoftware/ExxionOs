"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { toMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Collection,
  CollectionStatus,
  Idea,
  IdeaStatus,
  Issue,
  Material,
  MaterialKind,
  Product,
  Severity,
} from "@/lib/types";
import {
  COLLECTION_STATUSES,
  IDEA_STATUSES,
  MATERIAL_KINDS,
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
  materialId: string | null;
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
    material_id: input.materialId,
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

// --- materials + costing settings ------------------------------------------

export async function createMaterial(input: {
  name: string;
  kind: MaterialKind;
  costPerKg: number;
}): Promise<ActionResult<Material>> {
  await getSessionContext();
  const supabase = await createClient();

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "A material needs a name." };

  const { data, error } = await supabase
    .from("materials")
    .insert({
      name,
      kind: pick(input.kind, MATERIAL_KINDS, "filament"),
      cost_per_kg_minor: Math.abs(toMinor(input.costPerKg || 0)),
    })
    .select()
    .single<Material>();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  refreshCreative();
  return { ok: true, data };
}

export async function updateMaterial(
  id: string,
  input: { name: string; costPerKg: number }
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "A material needs a name." };

  const { error } = await supabase
    .from("materials")
    .update({
      name,
      cost_per_kg_minor: Math.abs(toMinor(input.costPerKg || 0)),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  // ⚠️ Re-pricing a material silently re-costs every product using it. That is
  // the intended behaviour (cost is computed, not stored) — so the Creative
  // pages must revalidate too, or they'd show yesterday's numbers.
  refreshCreative();
  return { ok: true, data: undefined };
}

/** ⚠️ Archive, never delete — see createCategory's twin in finance.ts. */
export async function archiveMaterial(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("materials")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  refreshCreative();
  return { ok: true, data: undefined };
}

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
