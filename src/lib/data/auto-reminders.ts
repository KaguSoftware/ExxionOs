import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { rowsOrThrow } from "@/lib/data/query";
import { todayInIstanbul } from "@/lib/utils";

/**
 * Create the reminders that standing signals owe the person opening the app.
 *
 * Two signals the workshop already stores but forgets to act on:
 *   * a client's BIRTHDAY (`clients.birthday`) — a nudge to reach out;
 *   * a machine's SERVICE-DUE date (`machines.next_service_on`).
 *
 * Modelled EXACTLY on `materialiseRecurring` (see `data/recurring.ts`): a
 * page-load heartbeat, not a cron (a cron is a second system that fails
 * silently), with the same three load-bearing properties —
 *
 * 1. **Idempotent** via the unique index
 *    `reminders (owner_id, source_type, source_id, due_on) where source_id is
 *    not null` (migration 0017). Two tabs or a double-open CANNOT create two
 *    birthday reminders — the database refuses the second (23505), which we
 *    swallow. Never rely on this function's own checks for that.
 * 2. **Never generates the future.** A birthday six months out gets no reminder
 *    yet — only ones landing inside `WINDOW_DAYS` from today.
 * 3. **Catches up.** A service date that fell due while nobody opened the app
 *    still generates its reminder, dated to when it was due, not today.
 *
 * ⚠️ Reminders are per-owner; generated rows are assigned to the acting user,
 * consistent with how hand-typed reminders are scoped.
 */
const WINDOW_DAYS = 14;

type ClientBirthday = { id: string; name: string; birthday: string | null };
type MachineService = { id: string; name: string; next_service_on: string | null };

type PendingReminder = {
  owner_id: string;
  body: string;
  due_on: string;
  source_type: string;
  source_id: string;
  generated: true;
};

export async function materialiseAutoReminders(
  supabase: SupabaseClient,
  ownerId: string,
  copy: { birthday: (name: string) => string; service: (name: string) => string }
): Promise<number> {
  const today = todayInIstanbul();
  const windowEnd = addDays(today, WINDOW_DAYS);

  const [clients, machines] = await Promise.all([
    rowsOrThrow<ClientBirthday>(
      "autoReminders.birthdays",
      supabase
        .from("clients")
        .select("id, name, birthday")
        .is("archived_at", null)
        .not("birthday", "is", null)
    ),
    rowsOrThrow<MachineService>(
      "autoReminders.service",
      supabase
        .from("machines")
        .select("id, name, next_service_on")
        .not("next_service_on", "is", null)
        // Service due today, in the window, OR already overdue (catch-up).
        .lte("next_service_on", windowEnd)
    ),
  ]);

  const pending: PendingReminder[] = [];

  for (const client of clients) {
    const due = nextBirthday(client.birthday!, today);
    // Only within the window ahead — never the far future.
    if (due > windowEnd) continue;
    pending.push({
      owner_id: ownerId,
      body: copy.birthday(client.name),
      due_on: due,
      source_type: "client",
      source_id: client.id,
      generated: true,
    });
  }

  for (const machine of machines) {
    pending.push({
      owner_id: ownerId,
      body: copy.service(machine.name),
      // The date it is due — catch-up keeps a past date, so it reads as overdue.
      due_on: machine.next_service_on!,
      source_type: "equipment",
      source_id: machine.id,
      generated: true,
    });
  }

  if (pending.length === 0) return 0;

  // One trip for every owed reminder, not one per row.
  const { error } = await supabase.from("reminders").insert(pending);

  // 23505 = unique violation: this owner already has these reminders. That is
  // the idempotency index working, not a failure — the rows exist, which is all
  // we wanted.
  if (error && error.code !== "23505") {
    throw new Error(`autoReminders.insert: ${error.code} ${error.message}`);
  }

  return error ? 0 : pending.length;
}

/**
 * The next occurrence of a MM-DD birthday on or after `today`.
 *
 * Reads month/day off the stored date and anchors them to this year, rolling to
 * next year if the day has already passed — so "born 1990-03-04" surfaces as
 * this year's (or next year's) 03-04, never the 1990 date.
 *
 * ⚠️ Feb 29 birthdays clamp to Feb 28 in common years, so they still surface
 * once a year rather than skipping three years out of four.
 */
function nextBirthday(birthday: string, today: string): string {
  const [, month, day] = birthday.split("-").map(Number);
  const year = Number(today.slice(0, 4));

  const thisYear = clampToMonth(year, month, day);
  if (thisYear >= today) return thisYear;
  return clampToMonth(year + 1, month, day);
}

function clampToMonth(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${`${month}`.padStart(2, "0")}-${`${safeDay}`.padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
