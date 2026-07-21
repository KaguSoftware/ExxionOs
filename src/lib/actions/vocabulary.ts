"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Vocabulary, VocabularyKind } from "@/lib/types";
import { VOCABULARY_KINDS } from "@/lib/types";
import { vocabLabel, vocabSlug } from "@/lib/vocab";

/** Never trust a string from the client to be one of a fixed set. */
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Words show up in pickers all over the app, so a change has to invalidate
 * broadly rather than one route.
 */
function refresh(kind: VocabularyKind) {
  if (kind === "product_type") {
    revalidatePath("/creative", "layout");
  } else {
    revalidatePath("/clients", "layout");
  }
  revalidatePath("/");
}

// --- create ----------------------------------------------------------------

/**
 * Add a word — or hand back the one that already means the same thing.
 *
 * ⚠️ RETURNS THE EXISTING ROW RATHER THAN ERRORING on a duplicate. Typing
 * "keychain" when "Keychain" exists is not a mistake to report; it is someone
 * picking the word they meant. The caller gets a row either way and cannot
 * tell the difference, which is the point.
 *
 * ⚠️ An ARCHIVED match is revived, not duplicated. The unique index on
 * `(kind, slug)` means a second row is impossible anyway, so without this the
 * insert would fail and typing a previously-retired word would look broken.
 */
export async function createVocabulary(input: {
  kind: VocabularyKind;
  label: string;
}): Promise<ActionResult<Vocabulary>> {
  await getSessionContext();
  const supabase = await createClient();

  const kind = pick(input.kind, VOCABULARY_KINDS, "product_type");
  const label = vocabLabel(input.label);
  const slug = vocabSlug(label);
  if (!slug) return { ok: false, error: "That word is empty." };

  const { data: existing } = await supabase
    .from("vocabularies")
    .select("*")
    .eq("kind", kind)
    .eq("slug", slug)
    .maybeSingle<Vocabulary>();

  if (existing) {
    if (!existing.archived_at) return { ok: true, data: existing };

    const { data: revived, error } = await supabase
      .from("vocabularies")
      .update({ archived_at: null })
      .eq("id", existing.id)
      .select()
      .single<Vocabulary>();

    if (error) return { ok: false, error: error.message };
    refresh(kind);
    return { ok: true, data: revived };
  }

  const { data, error } = await supabase
    .from("vocabularies")
    .insert({ kind, label, slug })
    .select()
    .single<Vocabulary>();

  if (error) return { ok: false, error: error.message };

  refresh(kind);
  return { ok: true, data };
}

// --- rename ----------------------------------------------------------------

/**
 * Rename a word AND rewrite it everywhere it is stored.
 *
 * ⚠️ THIS IS THE PRICE OF STORING LABELS INSTEAD OF FOREIGN KEYS. The registry
 * is not the source of truth for what a product says — the product's own
 * `kind` column is. So renaming has to propagate, or the registry would show
 * "Keyring" while every product still read "Keychain".
 *
 * The rows are rewritten FIRST and the registry LAST: if propagation fails
 * halfway, the registry still names the old word, which matches what most rows
 * say and can simply be retried. The reverse order would leave a renamed
 * registry entry pointing at data nobody rewrote.
 */
export async function renameVocabulary(
  id: string,
  nextLabel: string
): Promise<ActionResult<Vocabulary>> {
  await getSessionContext();
  const supabase = await createClient();

  const label = vocabLabel(nextLabel);
  const slug = vocabSlug(label);
  if (!slug) return { ok: false, error: "That word is empty." };

  const { data: current, error: readError } = await supabase
    .from("vocabularies")
    .select("*")
    .eq("id", id)
    .single<Vocabulary>();

  if (readError) return { ok: false, error: readError.message };

  // Renaming onto a word that already exists would collide with the unique
  // index. Merging the two is a different, destructive operation — refuse
  // rather than guess.
  if (slug !== current.slug) {
    const { data: clash } = await supabase
      .from("vocabularies")
      .select("id")
      .eq("kind", current.kind)
      .eq("slug", slug)
      .maybeSingle();

    if (clash) {
      return { ok: false, error: `"${label}" already exists.` };
    }
  }

  if (current.kind === "product_type") {
    const { error } = await supabase
      .from("products")
      .update({ kind: label })
      .eq("kind", current.label);

    if (error) return { ok: false, error: error.message };
  } else {
    const propagated = await rewriteClientTag(supabase, current.label, label);
    if (!propagated.ok) return propagated;
  }

  const { data, error } = await supabase
    .from("vocabularies")
    .update({ label, slug })
    .eq("id", id)
    .select()
    .single<Vocabulary>();

  if (error) return { ok: false, error: error.message };

  refresh(current.kind);
  return { ok: true, data };
}

/**
 * Swap one tag for another across every client that carries it.
 *
 * `tags` is a `text[]`, so there is no single-statement update that rewrites
 * one element — read the affected rows, map them in JS, write them back. The
 * GIN index (0009) makes the `contains` lookup cheap, and at two users the
 * affected set is small.
 */
async function rewriteClientTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
): Promise<ActionResult> {
  const { data: rows, error } = await supabase
    .from("clients")
    .select("id, tags")
    .contains("tags", [from]);

  if (error) return { ok: false, error: error.message };

  for (const row of rows ?? []) {
    // Dedupe: if the client already had the destination tag, renaming must
    // not leave it listed twice.
    const next = [...new Set(row.tags.map((t: string) => (t === from ? to : t)))];
    const { error: writeError } = await supabase
      .from("clients")
      .update({ tags: next })
      .eq("id", row.id);

    if (writeError) return { ok: false, error: writeError.message };
  }

  return { ok: true, data: undefined };
}

// --- archive / delete ------------------------------------------------------

export async function archiveVocabulary(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("vocabularies")
    .select("kind")
    .eq("id", id)
    .single<{ kind: VocabularyKind }>();

  if (readError) return { ok: false, error: readError.message };

  const { error } = await supabase
    .from("vocabularies")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  refresh(current.kind);
  return { ok: true, data: undefined };
}

/** How many records currently use this word. Drives the delete affordance. */
export async function countVocabularyUsage(
  id: string
): Promise<ActionResult<number>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("vocabularies")
    .select("kind, label")
    .eq("id", id)
    .single<{ kind: VocabularyKind; label: string }>();

  if (readError) return { ok: false, error: readError.message };

  const { count, error } =
    current.kind === "product_type"
      ? await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("kind", current.label)
      : await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .contains("tags", [current.label]);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: count ?? 0 };
}

/**
 * Delete a word outright — ONLY when nothing uses it.
 *
 * ⚠️ Deleting an in-use word would not corrupt anything (the label lives on
 * the record, not behind an FK), but it WOULD make a word that is visibly on
 * screen impossible to pick again — which reads as data loss. The refusal is
 * deliberate: the caller is expected to offer archive instead.
 */
export async function deleteVocabulary(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const usage = await countVocabularyUsage(id);
  if (!usage.ok) return usage;
  if (usage.data > 0) {
    return {
      ok: false,
      error: `Still used by ${usage.data} record${usage.data === 1 ? "" : "s"}. Archive it instead.`,
    };
  }

  const { data: current, error: readError } = await supabase
    .from("vocabularies")
    .select("kind")
    .eq("id", id)
    .single<{ kind: VocabularyKind }>();

  if (readError) return { ok: false, error: readError.message };

  const { error } = await supabase.from("vocabularies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh(current.kind);
  return { ok: true, data: undefined };
}
