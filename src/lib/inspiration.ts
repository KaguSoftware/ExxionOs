import { vocabLabel, vocabSlug } from "@/lib/vocab";

import type { Board, Idea, IdeaImage } from "@/lib/types";

/**
 * Pure helpers for the Inspiration board. No React, no Supabase — so they can
 * be reasoned about (and one day unit-tested) on their own.
 *
 * ⚠️ THE VOCABULARY OF THIS SECTION. An "idea" and a "pin" are the same row
 * (see 0025). The words are used deliberately: `Idea` is the type, "pin" is
 * what it is called on the board, and neither implies a different record.
 */

/** As many tags as fit on a card before the row stops being scannable. */
export const MAX_IDEA_TAGS = 20;

/**
 * Clean a pin's tags: trim, collapse whitespace, drop empties, de-duplicate by
 * the SAME slug rule the vocabulary registry uses, and cap the count.
 *
 * ⚠️ De-duping by `vocabSlug` rather than by exact string is what stops `Matte`
 * and `matte ` sitting on one pin as two tags. The user's own spelling of the
 * first occurrence is what gets kept — matching `vocabLabel`'s contract.
 */
export function normaliseIdeaTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of tags ?? []) {
    const label = vocabLabel(raw);
    if (!label) continue;
    const slug = vocabSlug(label);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(label);
  }

  return out.slice(0, MAX_IDEA_TAGS);
}

/**
 * The CSS `aspect-ratio` for a pin's card, or null when unknown.
 *
 * ⚠️ Null is the honest answer and the card falls back to a 4:5 box. Guessing
 * a ratio would be worse than admitting we don't know one: the whole reason
 * dimensions are stored is that a WRONG box reflows the masonry the moment the
 * real picture lands.
 */
export function pinAspect(image: IdeaImage | undefined): number | undefined {
  if (!image?.width || !image?.height) return undefined;
  return image.width / image.height;
}

/**
 * Group a flat `idea_images` read by pin, each list in `sort_order`.
 *
 * The whole table is read in the page's one wave and grouped here — the same
 * shape `collections/[id]/page.tsx` uses for product images. A query per pin
 * would be forty round-trips for a board that renders in one.
 */
export function imagesByIdea(images: IdeaImage[]): Map<string, IdeaImage[]> {
  const map = new Map<string, IdeaImage[]>();
  for (const image of images) {
    const list = map.get(image.idea_id);
    if (list) list.push(image);
    else map.set(image.idea_id, [image]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return map;
}

/** How many pins each board holds, keyed by board id. */
export function boardPinCounts(ideas: Idea[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    if (!idea.board_id) continue;
    counts.set(idea.board_id, (counts.get(idea.board_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Every tag actually in use, most-used first, then alphabetical.
 *
 * Powers the filter chips. Reads the PINS, not the vocabulary registry: a word
 * that exists but is on nothing would be a filter that always returns empty.
 */
export function tagsInUse(ideas: Idea[]): { label: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const idea of ideas) {
    for (const tag of idea.tags ?? []) {
      const slug = vocabSlug(tag);
      if (!slug) continue;
      const hit = counts.get(slug);
      if (hit) hit.count += 1;
      else counts.set(slug, { label: tag, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

/** Case-insensitive tag match, so a filter chip finds `Matte` from `matte`. */
export function hasTag(idea: Idea, tag: string): boolean {
  const slug = vocabSlug(tag);
  return (idea.tags ?? []).some((t) => vocabSlug(t) === slug);
}

/**
 * A short label for where a pin came from — the source's hostname.
 *
 * Used as the chip on a link-only pin, which is the ONLY thing distinguishing
 * "a site that wouldn't hand over its picture" from "a pin someone forgot to
 * illustrate". Without it a failed capture looks like an empty note.
 */
export function sourceLabel(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Live boards in display order; archived ones sink out of the pickers. */
export function liveBoards(boards: Board[]): Board[] {
  return boards
    .filter((b) => b.archived_at === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The first picture of a pin, or undefined — what a tile renders. */
export function firstImage(
  byIdea: Map<string, IdeaImage[]>,
  ideaId: string
): IdeaImage | undefined {
  return byIdea.get(ideaId)?.[0];
}

/**
 * Everything about a pin that search should look at, flattened once.
 *
 * ⚠️ Includes the BOARD NAME and the SOURCE HOSTNAME, not just the pin's own
 * columns. "that lamp thing from the Danish site" and "what's in Packaging" are
 * both how people actually look for a picture they saw once, and neither is a
 * substring of title or body.
 */
export function pinHaystack(idea: Idea, boardName: string | null): string {
  return [
    idea.title,
    idea.body ?? "",
    (idea.tags ?? []).join(" "),
    sourceLabel(idea.source_url) ?? "",
    boardName ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * AND across whitespace-separated tokens, so "brass lamp" narrows rather than
 * widening — typing more words should always mean fewer results.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}
