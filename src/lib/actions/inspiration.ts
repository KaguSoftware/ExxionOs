"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { normaliseIdeaTags } from "@/lib/inspiration";
import { normaliseLinks } from "@/lib/links";
import { imageExtension, parseOpenGraph, sniffImageSize } from "@/lib/og";
import { createClient } from "@/lib/supabase/server";
import { assertPublicHttpUrl, UnsafeUrlError } from "@/lib/url-guard";
import type { ActionResult, Board, Collection, Idea, IdeaStatus } from "@/lib/types";
import { IDEA_STATUSES } from "@/lib/types";

/**
 * Inspiration — boards, pins, and the URL capture.
 *
 * ⚠️ THIS MODULE OWNS `ideas`. They were creative.ts's until 0025 moved the
 * feature into its own section; leaving them there would have meant every pin
 * edit revalidating /creative and none of them revalidating /inspiration.
 * `promoteIdea` is the one action that touches both sections, and it lives here
 * because whoever owns the idea owns the promotion.
 */

/** Never trust a client string to be one of a fixed set. */
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function refreshInspiration(boardId?: string | null) {
  revalidatePath("/inspiration");
  if (boardId) revalidatePath(`/inspiration/boards/${boardId}`);
  revalidatePath("/");
}

// --- boards ----------------------------------------------------------------

export async function createBoard(input: {
  name: string;
  description: string | null;
}): Promise<ActionResult<Board>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .insert({
      name: input.name.trim().slice(0, 120) || "Untitled board",
      description: input.description?.trim().slice(0, 4000) || null,
      created_by: ctx.userId,
    })
    .select()
    .single<Board>();

  if (error) return { ok: false, error: error.message };
  refreshInspiration();
  return { ok: true, data };
}

/** Returns the row, so the form can navigate the same way create does. */
export async function updateBoard(
  id: string,
  input: { name: string; description: string | null }
): Promise<ActionResult<Board>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .update({
      name: input.name.trim().slice(0, 120) || "Untitled board",
      description: input.description?.trim().slice(0, 4000) || null,
    })
    .eq("id", id)
    .select()
    .single<Board>();

  if (error) return { ok: false, error: error.message };
  refreshInspiration(id);
  return { ok: true, data };
}

export async function archiveBoard(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("boards")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshInspiration(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ DELETING A BOARD KEEPS ITS PINS. `ideas.board_id` is `on delete set null`
 * (0025), so every picture filed here falls back to the unsorted lens rather
 * than vanishing with the folder. The confirm dialog says so — a user who
 * expects Pinterest's behaviour would otherwise assume the opposite.
 */
export async function deleteBoard(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refreshInspiration();
  return { ok: true, data: undefined };
}

/** Use one of the board's own pin photos as its cover. */
export async function setBoardCover(
  boardId: string,
  path: string | null
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("boards")
    .update({ cover_path: path })
    .eq("id", boardId);

  if (error) return { ok: false, error: error.message };
  refreshInspiration(boardId);
  return { ok: true, data: undefined };
}

// --- pins (ideas) ----------------------------------------------------------

export type PinInput = {
  title: string;
  body: string | null;
  boardId: string | null;
  tags: string[];
  links: string[];
};

/**
 * Create a pin.
 *
 * ⚠️ AN EMPTY TITLE IS KEPT EMPTY, unlike collections and products which fall
 * back to "Untitled". A dropped photograph with no caption is a complete pin —
 * stamping "Untitled idea" across a wall of pictures would be noise on every
 * card, and the picture already says what it is.
 */
export async function createPin(
  input: Partial<PinInput> & { title?: string }
): Promise<ActionResult<Idea>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title: (input.title ?? "").trim().slice(0, 200),
      body: input.body?.trim().slice(0, 4000) || null,
      board_id: input.boardId ?? null,
      tags: normaliseIdeaTags(input.tags ?? []),
      links: normaliseLinks(input.links ?? []),
      created_by: ctx.userId,
    })
    .select()
    .single<Idea>();

  if (error) return { ok: false, error: error.message };
  refreshInspiration(input.boardId ?? null);
  return { ok: true, data };
}

/** Edit a pin. Status has its own one-click control, so it is untouched here. */
export async function updatePin(
  id: string,
  input: PinInput
): Promise<ActionResult<Idea>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ideas")
    .update({
      title: input.title.trim().slice(0, 200),
      body: input.body?.trim().slice(0, 4000) || null,
      board_id: input.boardId,
      tags: normaliseIdeaTags(input.tags),
      links: normaliseLinks(input.links),
    })
    .eq("id", id)
    .select()
    .single<Idea>();

  if (error) return { ok: false, error: error.message };
  refreshInspiration(input.boardId);
  revalidatePath(`/inspiration/pins/${id}`);
  return { ok: true, data };
}

/** Move a pin to another board (or to unsorted). The board-chip shortcut. */
export async function setPinBoard(
  id: string,
  boardId: string | null
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("ideas")
    .update({ board_id: boardId })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refreshInspiration(boardId);
  return { ok: true, data: undefined };
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
  refreshInspiration();
  return { ok: true, data: undefined };
}

/**
 * Delete a pin.
 *
 * `idea_images` cascades (0025), but the storage objects do not — so the paths
 * are read first and the files removed after, exactly as `detachImage` does.
 * Without this the bucket accumulates pictures nobody can reach.
 */
export async function deleteIdea(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("idea_images")
    .select("path")
    .eq("idea_id", id);

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  const paths = (images ?? []).map((row: { path: string }) => row.path);
  if (paths.length > 0) await supabase.storage.from("creative").remove(paths);

  refreshInspiration();
  return { ok: true, data: undefined };
}

/**
 * "Make it" — turn a pin into a collection.
 *
 * The pin keeps its row and gains `collection_id`, so you can always see which
 * collections began as inspiration. It is NOT deleted or moved: a pin and the
 * collection it became are two records of two different moments.
 *
 * ⚠️ Revalidates BOTH sections — this is the one action that crosses from
 * Inspiration into Creative, and a stale /creative would hide the new project.
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
  if (!idea) return { ok: false, error: "missing" };
  if (idea.collection_id) {
    // Already promoted — hand back the existing collection rather than minting
    // a second one, so a double-click cannot create duplicates.
    return { ok: true, data: { collectionId: idea.collection_id } };
  }

  const { data: collection, error: createError } = await supabase
    .from("collections")
    .insert({
      // A pin may legitimately have no title (see createPin); a collection
      // showing a blank name in a list of projects would be unusable, so this
      // is the one place the fallback belongs.
      name: idea.title.trim() || "Untitled collection",
      description: idea.body,
      status: "planned",
      links: idea.links ?? [],
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

  refreshInspiration(idea.board_id);
  revalidatePath("/creative");
  return { ok: true, data: { collectionId: collection.id } };
}

// --- URL capture -----------------------------------------------------------

/** Stop reading a page once we have far more head than any site puts there. */
const HTML_BUDGET = 512 * 1024;
/** Matches the browser uploader's cap, so there is one number to remember. */
const IMAGE_BUDGET = 5 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 5_000;
const IMAGE_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 3;

/** A real browser UA. Many sites serve a stub or a 403 to anything else, and a
 *  stub has no og:image — which would read to the user as "capture is broken". */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Read a response body up to `limit` bytes, then stop pulling.
 *
 * ⚠️ NOT `await res.text()`. A hostile or merely broken origin can stream
 * gigabytes, and `.text()` would hold a serverless function open buffering all
 * of it. The cap is the guard, not a nicety.
 */
async function readCapped(
  res: Response,
  limit: number
): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});

  const out = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= out.length) break;
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}

/**
 * Fetch a URL, following redirects BY HAND and re-guarding every hop.
 *
 * ⚠️ `redirect: "follow"` WOULD DEFEAT THE SSRF GUARD. A perfectly public URL
 * can 302 straight to `http://169.254.169.254/`, and fetch would follow it
 * without ever consulting `assertPublicHttpUrl` again. Manual it is.
 */
async function guardedFetch(
  startUrl: URL,
  timeoutMs: number,
  accept: string
): Promise<{ res: Response; url: URL } | null> {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": USER_AGENT, accept, "accept-language": "en" },
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) return null;
      try {
        url = await assertPublicHttpUrl(new URL(location, url).toString());
      } catch {
        return null;
      }
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return { res, url };
  }

  return null;
}

/**
 * Paste a URL, get a pin.
 *
 * ⚠️ EVERY FAILURE AFTER THE ROW IS CREATED STILL RETURNS A PIN. The result
 * carries `imageAttached: false` and the card renders link-only with the
 * source's hostname as a chip. Instagram lands here every time (a login wall
 * serves no usable og:image) and Pinterest intermittently; the honest fallback
 * is the feature, not a consolation prize. Nothing the user typed is discarded.
 *
 * Errors BEFORE the row exists return sentinel codes ("badUrl"), never raw
 * English — the client maps them to i18n keys, the way auth.ts does.
 */
export async function captureFromUrl(input: {
  url: string;
  boardId: string | null;
}): Promise<ActionResult<{ ideaId: string; imageAttached: boolean }>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  // Reuse the links contract, so typing `example.com/thing` works.
  const [normalised] = normaliseLinks([input.url]);
  if (!normalised) return { ok: false, error: "badUrl" };

  let target: URL;
  try {
    target = await assertPublicHttpUrl(normalised);
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false, error: "badUrl" };
    return { ok: false, error: "badUrl" };
  }

  // --- 1. the page ---------------------------------------------------------
  let pageUrl = target;
  let title: string | null = null;
  let description: string | null = null;
  let imageUrl: URL | null = null;

  const page = await guardedFetch(
    target,
    PAGE_TIMEOUT_MS,
    "text/html,application/xhtml+xml,image/*"
  );

  if (page) {
    pageUrl = page.url;
    const contentType = page.res.headers.get("content-type");

    if (contentType?.toLowerCase().startsWith("image/")) {
      // The user pasted a direct image link. No page to parse.
      await page.res.body?.cancel().catch(() => {});
      imageUrl = pageUrl;
      title = decodeURIComponent(pageUrl.pathname.split("/").pop() ?? "");
    } else {
      const bytes = await readCapped(page.res, HTML_BUDGET);
      const charset = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
      let html = "";
      try {
        html = new TextDecoder(charset ?? "utf-8", { fatal: false }).decode(bytes);
      } catch {
        html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      }

      const og = parseOpenGraph(html);
      title = og.title;
      description = og.description;
      if (og.image) {
        try {
          // og:image is very often relative — resolve against the FINAL url.
          imageUrl = await assertPublicHttpUrl(
            new URL(og.image, pageUrl).toString()
          );
        } catch {
          imageUrl = null;
        }
      }
    }
  }

  // --- 2. the pin, created FIRST -------------------------------------------
  // Before the picture, so a site that refuses one still leaves something
  // usable — and so the storage path has an id to hang off.
  const { data: idea, error: insertError } = await supabase
    .from("ideas")
    .insert({
      title: (title ?? pageUrl.hostname.replace(/^www\./, "")).trim().slice(0, 200),
      body: description?.trim().slice(0, 4000) || null,
      board_id: input.boardId,
      source_url: pageUrl.toString().slice(0, 2000),
      links: normaliseLinks([pageUrl.toString()]),
      created_by: ctx.userId,
    })
    .select()
    .single<Idea>();

  if (insertError) return { ok: false, error: insertError.message };

  // --- 3. the picture, best-effort -----------------------------------------
  let imageAttached = false;

  if (imageUrl) {
    const download = await guardedFetch(imageUrl, IMAGE_TIMEOUT_MS, "image/*");
    if (download) {
      const contentType = download.res.headers.get("content-type");
      const ext = imageExtension(contentType);

      // A declared length over budget is refused before a byte is read.
      const declared = Number(download.res.headers.get("content-length") ?? 0);
      if (!ext || declared > IMAGE_BUDGET) {
        await download.res.body?.cancel().catch(() => {});
      } else {
        const bytes = await readCapped(download.res, IMAGE_BUDGET);
        if (bytes.length > 0 && bytes.length < IMAGE_BUDGET) {
          const path = `idea/${idea.id}/${crypto.randomUUID()}.${ext}`;
          // The USER's client, not the service role: the `creative` bucket
          // already allows authenticated writes, so bypassing RLS here would
          // buy nothing and cost the audit trail.
          const { error: uploadError } = await supabase.storage
            .from("creative")
            .upload(path, bytes, {
              contentType: contentType?.split(";")[0] ?? undefined,
              upsert: false,
            });

          if (!uploadError) {
            const { width, height } = sniffImageSize(bytes);
            const { error: attachError } = await supabase
              .from("idea_images")
              .insert({ idea_id: idea.id, path, width, height });
            imageAttached = !attachError;
          }
        }
      }
    }
  }

  refreshInspiration(input.boardId);
  return { ok: true, data: { ideaId: idea.id, imageAttached } };
}
