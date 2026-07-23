"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { normaliseLinks } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Client,
  ClientKind,
  ClientSource,
  Event,
  EventKind,
} from "@/lib/types";
import { CLIENT_KINDS, CLIENT_SOURCES } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Clients and events.
 *
 * ⚠️ `createClientRecord` / `updateClientRecord` LIVED IN `actions/shipping.ts`
 * until this phase, where they existed only so orders had a real foreign key
 * before Clients was built. They belong here now that Clients is a section of
 * its own — the same lift-and-share that moved `syncTransaction()` into
 * `actions/finance-link.ts` when Shipping became its second writer. One
 * implementation, so the field trimming cannot drift between two of them.
 */

const EVENT_KIND_VALUES: EventKind[] = [
  "call",
  "meeting",
  "message",
  "sample_sent",
  "complaint",
  "note",
  "filming",
  "networking",
  "campaign",
];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Same shape as `pick`, but null is a legitimate answer rather than a fallback. */
function pickOrNull<T extends string>(value: unknown, allowed: T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function refresh(clientId?: string) {
  revalidatePath("/clients");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  // A client's name renders on every order card, and the dashboard carries the
  // gone-quiet signal.
  revalidatePath("/shipping");
  revalidatePath("/");
}

// --- clients ---------------------------------------------------------------

export type ClientInput = {
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  city: string | null;
  notes: string | null;
  kind: ClientKind;
  source: ClientSource | null;
  tags: string[];
  links: string[];
  birthday: string | null;
  address: string | null;
  postalCode: string | null;
  country: string | null;
};

function clientRow(input: ClientInput) {
  return {
    // ⚠️ No required fields anywhere in this app: an empty submit asks once,
    // then proceeds. A row still needs a name, so it gets a placeholder rather
    // than a validation error that blocks the save.
    name: input.name.trim().slice(0, 120) || "Unnamed client",
    email: input.email?.trim().slice(0, 200) || null,
    phone: input.phone?.trim().slice(0, 60) || null,
    // Stored WITHOUT the leading @, so "@exxion" and "exxion" are one handle.
    instagram: input.instagram?.trim().replace(/^@/, "").slice(0, 60) || null,
    city: input.city?.trim().slice(0, 120) || null,
    notes: input.notes?.trim().slice(0, 4000) || null,
    kind: pick(input.kind, CLIENT_KINDS, "individual"),
    // ⚠️ null, not 'other'. "Nobody asked how they found us" and "they told us
    // it was something not on the list" are different facts, and the insights
    // panel reports them as different buckets.
    source: pickOrNull(input.source, CLIENT_SOURCES),
    tags: normaliseTags(input.tags),
    links: normaliseLinks(input.links),
    birthday: input.birthday || null,
    address: input.address?.trim().slice(0, 500) || null,
    postal_code: input.postalCode?.trim().slice(0, 30) || null,
    country: input.country?.trim().slice(0, 120) || null,
  };
}

/**
 * Lowercased, trimmed, de-duplicated, capped. Tags are for FINDING people, and
 * "Gift", "gift " and "gift" being three tags is exactly how a tag list stops
 * being useful.
 */
function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const tag = raw.trim().toLowerCase().slice(0, 40);
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, 25);
}

export async function createClientRecord(
  input: ClientInput
): Promise<ActionResult<Client>> {
  await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert(clientRow(input))
    .select()
    .single<Client>();

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data };
}

export async function updateClientRecord(
  id: string,
  input: ClientInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update(clientRow(input))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

/**
 * ⚠️ ARCHIVE, NEVER DELETE.
 *
 * `orders.client_id` is SET NULL, so deleting a client would silently detach
 * every past sale from the person who bought it — the order and its revenue
 * survive (proven in Phase 5), but "who was this for" is gone for good, and so
 * is that client's entire history. Archiving takes them out of the directory
 * and the analytics while keeping every order attributed. Same rule as
 * categories and materials.
 */
export async function archiveClient(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

export async function unarchiveClient(id: string): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, data: undefined };
}

// --- events ----------------------------------------------------------------

export type EventInput = {
  kind: EventKind;
  title: string;
  body: string | null;
  occurredOn: string;
  clientId: string | null;
  orderId: string | null;
};

function eventRow(input: EventInput) {
  return {
    kind: pick(input.kind, EVENT_KIND_VALUES, "note"),
    title: input.title.trim().slice(0, 200),
    body: input.body?.trim().slice(0, 4000) || null,
    // ⚠️ `todayInIstanbul()`, never `new Date().toISOString().slice(0,10)` —
    // the UTC form answers YESTERDAY between 00:00 and 03:00 local, so an
    // evening phone call would be logged on the wrong day.
    occurred_on: input.occurredOn || todayInIstanbul(),
    client_id: input.clientId || null,
    order_id: input.orderId || null,
  };
}

export async function createEvent(
  input: EventInput
): Promise<ActionResult<Event>> {
  const { userId } = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .insert({ ...eventRow(input), created_by: userId })
    .select()
    .single<Event>();

  if (error) return { ok: false, error: error.message };
  refresh(input.clientId ?? undefined);
  return { ok: true, data };
}

export async function updateEvent(
  id: string,
  input: EventInput
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("events").update(eventRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(input.clientId ?? undefined);
  return { ok: true, data: undefined };
}

/**
 * Events DO delete — unlike clients. An event is a note about something that
 * happened; nothing references it, no money hangs off it, and a mistyped one
 * is just noise. Archiving it would be ceremony with no payoff.
 */
export async function deleteEvent(
  id: string,
  clientId?: string
): Promise<ActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(clientId);
  return { ok: true, data: undefined };
}
