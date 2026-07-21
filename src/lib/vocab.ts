import type { Vocabulary, VocabularyKind } from "@/lib/types";

/** Longest a single word may be, matching the column's practical use. */
export const VOCAB_MAX_LENGTH = 60;

/**
 * The dedupe key for a user-typed word.
 *
 * ⚠️ THIS EXPRESSION IS DUPLICATED IN SQL — see the backfill in
 * `supabase/migrations/0011_vocabularies.sql`, which computes
 * `lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))`. The two must stay
 * identical: the database enforces uniqueness on `(kind, slug)`, so if this
 * function disagreed with the column it just wrote, an insert the UI believed
 * was new would fail on a constraint the user cannot see.
 *
 * Collapsing INTERNAL whitespace (not just trimming the ends) is what makes
 * `Key  Chain` and `Key Chain` the same word — which is the "spaces" half of
 * "avoid duplicates with capitals, spaces, or just full on duplicates".
 */
export function vocabSlug(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * What actually gets stored as the label: the user's own spelling, with only
 * the noise removed. Capitals are PRESERVED — `slug` handles matching, so
 * there is no reason to also flatten what someone typed. "Keychain" should
 * come back as "Keychain".
 */
export function vocabLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").slice(0, VOCAB_MAX_LENGTH);
}

/** Find an existing word by what someone typed, regardless of spelling. */
export function findVocab(
  items: Vocabulary[],
  label: string,
  kind?: VocabularyKind
): Vocabulary | undefined {
  const slug = vocabSlug(label);
  if (!slug) return undefined;
  return items.find(
    (v) => v.slug === slug && (kind === undefined || v.kind === kind)
  );
}

/**
 * Options a picker should offer: live words, plus any word THIS record already
 * uses even if archived.
 *
 * ⚠️ The second half matters. Archiving a word must not silently strip it off
 * the products that already carry it — the same rule
 * `transaction-form.tsx` follows for archived categories. Without this, opening
 * and saving an old product would quietly erase its type.
 */
export function vocabOptions(
  items: Vocabulary[],
  kind: VocabularyKind,
  inUse: string[] = []
): Vocabulary[] {
  const used = new Set(inUse.map(vocabSlug).filter(Boolean));
  return items
    .filter(
      (v) => v.kind === kind && (v.archived_at === null || used.has(v.slug))
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}
