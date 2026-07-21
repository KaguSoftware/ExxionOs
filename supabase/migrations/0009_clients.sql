-- 0009_clients.sql — Clients: CRM columns, and the kind-tagged `events` table.
--
-- ⚠️ THE `clients` TABLE ALREADY EXISTS. It was built in 0008 (Shipping),
-- deliberately ahead of its own phase, so orders had a real foreign key from
-- day one instead of a text field to migrate later. This migration is
-- STRICTLY ADDITIVE: it adds columns and a new table. Nothing here drops,
-- renames or retypes an existing column, because `orders.client_id` and every
-- past sale depend on those rows staying exactly as they are.
--
-- ⚠️ AND THE RULE THIS WHOLE SECTION TURNS ON, restated because Clients is
-- where it is most tempting to break:
--   A CLIENT'S LIFETIME VALUE IS READ FROM `transactions`, NEVER BY SUMMING
--   `orders.total_minor`.
-- The total is what was AGREED; the money is what arrived. A client with a
-- ₺5.000 quote they never paid is not a ₺5.000 client. "Top clients" sums the
-- `transactions` rows written by their orders' payments — the same single
-- source of truth that machine spend (0005) and order revenue (0008) use.

-- ---------------------------------------------------------------------------
-- clients — the CRM columns
-- ---------------------------------------------------------------------------

alter table public.clients
  -- Individual / business / reseller. A reseller's ₺20.000 is a different kind
  -- of number from a one-off gift buyer's, and averaging them hides both.
  add column if not exists kind text not null default 'individual',

  -- HOW THEY FOUND EXXION. This is the column that makes "which channel
  -- actually brings the money" answerable — and it is answerable only if it is
  -- a FIXED LIST. Free text ("insta", "Instagram", "IG") cannot be grouped.
  add column if not exists source text,

  -- Free-form, deliberately: tags are where vocabulary that hasn't settled yet
  -- goes, without needing a migration each time Parsa invents one. Analytics
  -- reads `source`/`kind`; tags are for finding people.
  add column if not exists tags text[] not null default '{}',

  -- A date to hang a reminder off. `reminders` (0001) already carries
  -- source_type/source_id, so "message them" is a reminder pointed at a client
  -- and it lands in the dashboard strip for free — no new table.
  add column if not exists birthday date,

  -- Address sits BESIDE the existing `city`, it does not replace it. `city` is
  -- already populated and is what the source/region breakdowns group by.
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists country text;

-- ⚠️ CHECK-constrained text, not a Postgres enum — matching `orders.stage`
-- (0008) and `transactions.direction` (0003). Adding "tiktok" later is then an
-- `alter constraint` in a two-line migration, not an `alter type` that locks
-- the table and cannot be run inside a transaction.
--
-- Dropped-then-added so re-running this file after the list grows is safe.
alter table public.clients drop constraint if exists clients_kind_check;
alter table public.clients add constraint clients_kind_check
  check (kind in ('individual', 'business', 'reseller'));

-- Nullable: a client entered before anyone thought to ask how they found us
-- has an UNKNOWN source, which is a real and different answer from 'other'.
-- The insights panel shows the unknown bucket rather than quietly dropping it.
alter table public.clients drop constraint if exists clients_source_check;
alter table public.clients add constraint clients_source_check
  check (source is null or source in
    ('instagram', 'referral', 'market', 'walk_in', 'website', 'other'));

create index if not exists clients_source_idx
  on public.clients (source)
  where archived_at is null;

-- GIN, because `tags @> '{gift}'` on a btree index is a sequential scan.
create index if not exists clients_tags_idx
  on public.clients using gin (tags);

-- ---------------------------------------------------------------------------
-- events — ONE table, kind-tagged, TWO lenses
-- ---------------------------------------------------------------------------
-- The same shape as `issues` → Learnings (0004), and for the same reason: a
-- client's timeline and Marketing's schedule are two VIEWS of "something
-- happened on a date", not two tables someone has to keep in sync. Two tables
-- drift; one table cannot.
--
-- ⚠️ THE MARKETING KINDS ARE IN THE CHECK FROM DAY ONE ('filming',
-- 'networking', 'campaign') even though Phase 6 renders none of them. Phase 7
-- then adds a lens over existing rows instead of a migration that widens a
-- constraint — and a filming day logged early is not rejected by the database
-- just because its surface hasn't shipped.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),

  kind        text not null default 'note'
                check (kind in ('call', 'meeting', 'message', 'sample_sent',
                                'complaint', 'note',
                                'filming', 'networking', 'campaign')),

  title       text not null default '',
  body        text,

  -- A DATE, not a timestamp. These are business facts ("we met on the 4th"),
  -- and every domain date in this app is a date — see todayInIstanbul() in
  -- src/lib/utils.ts for why a UTC clock is the wrong tool for them.
  occurred_on date not null,

  -- ⚠️ SET NULL, NOT CASCADE — matching issues.collection_id (0004). Deleting
  -- a client must not delete the record that the meeting happened, the sample
  -- was sent, or the complaint was made. That history outlives the row it
  -- points at, exactly as a lesson learned outlives its collection.
  client_id   uuid references public.clients (id) on delete set null,

  -- Optional second anchor: "the complaint about order EX-014". Also SET NULL —
  -- deleting the order must not erase the complaint.
  order_id    uuid references public.orders (id) on delete set null,

  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

-- The client timeline reads (client_id, occurred_on desc); the Marketing lens
-- and the app-wide feed read (kind, occurred_on desc). One index each.
create index if not exists events_client_idx
  on public.events (client_id, occurred_on desc)
  where client_id is not null;

create index if not exists events_kind_idx
  on public.events (kind, occurred_on desc);

create index if not exists events_order_idx
  on public.events (order_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — two trusted users, so the domain policy is simply "authenticated".
-- RLS being ON is what stops the anon key.
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;

drop policy if exists events_all on public.events;
create policy events_all on public.events for all
  to authenticated using (true) with check (true);
