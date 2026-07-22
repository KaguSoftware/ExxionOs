-- 0017_auto_reminders.sql — Auto-generated reminders.
--
-- The `reminders` table (0001) already carries a loose `source_type`/`source_id`
-- back-link and lands in the dashboard "Needs you" strip and Reminders panel for
-- free. Until now nothing WROTE those rows automatically — every reminder was
-- hand-typed. This migration lets two standing signals the workshop already
-- stores create their own reminders on dashboard load:
--
--   * a client's BIRTHDAY (clients.birthday, added 0009) — a nudge to reach out;
--   * a machine's SERVICE-DUE date (new column below).
--
-- The generator (`src/lib/data/auto-reminders.ts`) mirrors the recurring
-- materialiser exactly: it runs on page load, catches up, never generates the
-- future, and — the load-bearing part — is made idempotent by a UNIQUE INDEX,
-- not by JS checks that a race between two tabs would beat.

-- ---------------------------------------------------------------------------
-- machines.next_service_on — when the machine is next due for service.
-- ---------------------------------------------------------------------------
-- ⚠️ NULLABLE, and null is the normal case: "no schedule set". Same null
-- semantics as clients.source — absence is a real, distinct answer, not a zero.
alter table public.machines
  add column if not exists next_service_on date;

-- ---------------------------------------------------------------------------
-- reminders.generated — marks rows the generator created.
-- ---------------------------------------------------------------------------
-- Lets the UI badge auto-reminders and lets the generator tell its own rows
-- apart from hand-typed ones. Defaults false, so every existing reminder reads
-- correctly as hand-entered.
alter table public.reminders
  add column if not exists generated boolean not null default false;

-- ---------------------------------------------------------------------------
-- The idempotency guarantee.
-- ---------------------------------------------------------------------------
-- ⚠️ THIS INDEX, NOT THE JS, IS WHAT STOPS DUPLICATE REMINDERS. Two tabs, a
-- double-open, or both people opening the app at once CANNOT create two "wish
-- Ayşe a happy birthday" rows for the same owner and date — the database
-- refuses the second (23505), which the generator swallows. Exactly the shape
-- of the recurring index in 0003.
--
-- Scoped to `source_id is not null` so it constrains ONLY generated,
-- back-linked rows; two identical hand-typed reminders (no source) stay legal.
create unique index if not exists reminders_auto_once_idx
  on public.reminders (owner_id, source_type, source_id, due_on)
  where source_id is not null;
