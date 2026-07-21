import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Make a failed query FAIL, instead of rendering as a calm empty state.
 *
 * ⚠️ THIS IS THE MOST IMPORTANT FILE IN THE DATA LAYER. The pattern it
 * replaces —
 *
 *     const { data } = await supabase.from("x").select();
 *     return data ?? [];
 *
 * — is why a missing migration once looked, company-wide, like "you have no
 * data". A broken query and an empty table were indistinguishable on screen.
 * On KaguOs that took a long time to diagnose precisely because nothing
 * appeared to be wrong.
 *
 * Every query in this app goes through one of these WITH A LABEL. The label is
 * the point: the thrown error reads
 *
 *     transactions: 42703 column transactions.amount_try does not exist
 *
 * which is diagnosable from the error boundary without opening a server log.
 *
 * ⚠️ Wrap a QUERY, never a WAVE. Waves are not uniform: some entries are a
 * plain `Promise.resolve(...)` stand-in with no `error` to inspect, and
 * head-only `count` queries return `data: null` BY DESIGN. A wave-level
 * wrapper breaks both.
 */

type Result<T> = { data: T | null; error: PostgrestError | null };

function fail(label: string, error: PostgrestError): never {
  const detail = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" · ");
  throw new Error(`${label}: ${error.code ?? "error"} ${detail}`);
}

/**
 * For list queries. Returns rows and never null, so callers can map directly.
 */
export async function rowsOrThrow<T>(
  label: string,
  query: PromiseLike<Result<T[]>>
): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(label, error);
  return data ?? [];
}

/**
 * For everything else — when you need `count`, or a `maybeSingle()` row that
 * is legitimately null. Returns the whole result so those survive.
 */
export async function selectOrThrow<T>(
  label: string,
  query: PromiseLike<Result<T> & { count?: number | null }>
): Promise<{ data: T | null; count: number | null }> {
  const result = await query;
  if (result.error) fail(label, result.error);
  return { data: result.data ?? null, count: result.count ?? null };
}

/** Head-only count queries: `data` is null by design, only `count` matters. */
export async function countOrThrow(
  label: string,
  query: PromiseLike<{ error: PostgrestError | null; count: number | null }>
): Promise<number> {
  const { error, count } = await query;
  if (error) fail(label, error);
  return count ?? 0;
}
