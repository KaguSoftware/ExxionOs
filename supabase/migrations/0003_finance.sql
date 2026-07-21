-- 0003_finance.sql — Finance: the hub every other section writes into.
--
-- ⚠️ `transactions` IS A CONTRACT. Equipment (phase 4), Shipping (5), Clients (6)
-- and Marketing (7) all insert into it, tagging rows with source_type/source_id so
-- every figure in Finance can be traced back to the thing that caused it. Changing
-- its shape later means migrating real financial data — get it right here.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('income', 'expense')),
  -- Chart colour comes from the validated categorical palette, assigned by
  -- sort_order in the app. This column is an optional override.
  color       text,
  icon        text,
  sort_order  integer not null default 0,
  -- ⚠️ ARCHIVE, NEVER DELETE. Deleting a category would orphan historical
  -- transactions and silently change past totals — the one thing a finance
  -- system must never do. Archived categories stop appearing in pickers but
  -- keep labelling the history they already explain.
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create index if not exists categories_kind_sort_idx
  on public.categories (kind, sort_order)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- recurring_items  (declared before transactions — transactions references it)
-- ---------------------------------------------------------------------------
-- A TEMPLATE. It does not hold money itself; it MATERIALISES real transaction
-- rows (see src/lib/data/recurring.ts). That way history is real, editable data
-- — you can correct one month or record that you skipped it — and every chart
-- and total reads one table with no special-casing.

create table if not exists public.recurring_items (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,
  direction         text not null check (direction in ('in', 'out')),
  amount_minor      bigint not null check (amount_minor >= 0),
  category_id       uuid references public.categories (id) on delete set null,
  cadence           text not null check (cadence in ('monthly', 'quarterly', 'yearly')),
  -- 1–31. A value past the end of a short month clamps to that month's last
  -- day (February gets the 28th/29th) rather than skipping the month.
  day_of_month      integer not null default 1 check (day_of_month between 1 and 31),
  starts_on         date not null,
  ends_on           date,
  -- Bookkeeping for the generator. The unique index on transactions is what
  -- actually guarantees correctness; this is an optimisation so a catch-up
  -- doesn't rescan from starts_on every page load.
  last_generated_on date,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists recurring_items_set_updated_at on public.recurring_items;
create trigger recurring_items_set_updated_at
  before update on public.recurring_items
  for each row execute function private.set_updated_at();

create index if not exists recurring_items_active_idx
  on public.recurring_items (active, starts_on)
  where active;

-- ---------------------------------------------------------------------------
-- transactions — THE HUB
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  occurred_on  date not null,
  direction    text not null check (direction in ('in', 'out')),

  -- ⚠️ MONEY IS AN INTEGER NUMBER OF KURUŞ. 1250.50 TRY is stored as 125050.
  -- Floating point accumulates rounding error (0.1 + 0.2 != 0.3), and a total
  -- that is wrong by one kuruş destroys trust in every other number on the
  -- page. Convert exactly once, at the server-action boundary.
  --
  -- ⚠️ THE AMOUNT IS A POSITIVE MAGNITUDE; `direction` CARRIES THE SIGN.
  -- Storing a signed amount AND a direction is two sources of truth for one
  -- fact, and they drift the first time someone edits a row.
  amount_minor bigint not null check (amount_minor >= 0),

  description  text not null default '',
  category_id  uuid references public.categories (id) on delete set null,
  note         text,
  -- Path in the private `receipts` bucket. NEVER a signed URL — those are
  -- minted in the click handler (see components/ui/signed-file-link.tsx).
  receipt_path text,

  -- ⚠️ THE CROSS-SECTION CONTRACT. When Equipment logs a repair or Marketing
  -- gives away a sample, it inserts here with these two set. Deliberately a
  -- loose pair and NOT a foreign key (same shape as reminders.source_* in
  -- 0001): any future section can write into it without a migration, and the
  -- UI resolves the link only when it recognises the type.
  source_type  text,
  source_id    uuid,

  -- Set on rows produced by a recurring template. Nullable, and that carries
  -- the meaning: null = entered by hand.
  recurring_id uuid references public.recurring_items (id) on delete set null,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function private.set_updated_at();

-- ⚠️ THE IDEMPOTENCY GUARANTEE FOR RECURRING ITEMS.
-- The generator runs on page load, so two tabs, a double-click, or both people
-- opening the app at once would otherwise race and produce duplicate rent.
-- This index makes that impossible in the database rather than hoping the
-- application logic wins the race. `where recurring_id is not null` keeps
-- hand-entered rows free to repeat (two coffees on one day is legitimate).
create unique index if not exists transactions_recurring_once_idx
  on public.transactions (recurring_id, occurred_on)
  where recurring_id is not null;

-- Indexes matched to the queries the Finance page actually runs.
create index if not exists transactions_occurred_idx
  on public.transactions (occurred_on desc);
create index if not exists transactions_category_idx
  on public.transactions (category_id, occurred_on desc);
create index if not exists transactions_source_idx
  on public.transactions (source_type, source_id)
  where source_type is not null;

-- ---------------------------------------------------------------------------
-- RLS — enabled everywhere; two trusted users, so the policy itself is simple.
-- Enabled is what matters: it stops the anon key.
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.recurring_items enable row level security;
alter table public.transactions enable row level security;

drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all
  to authenticated using (true) with check (true);

drop policy if exists recurring_items_all on public.recurring_items;
create policy recurring_items_all on public.recurring_items for all
  to authenticated using (true) with check (true);

drop policy if exists transactions_all on public.transactions;
create policy transactions_all on public.transactions for all
  to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed categories
-- ---------------------------------------------------------------------------
-- Starting vocabulary for a 3D-printing shop. Idempotent, so re-running the
-- migration doesn't duplicate them. Renameable and archivable from the UI.

insert into public.categories (name, kind, sort_order)
select * from (values
  ('Sales',          'income',  10),
  ('Commissions',    'income',  20),
  ('Other income',   'income',  90),
  ('Filament',       'expense', 10),
  ('Resin',          'expense', 20),
  ('Equipment',      'expense', 30),
  ('Maintenance',    'expense', 40),
  ('Packaging',      'expense', 50),
  ('Shipping',       'expense', 60),
  ('Marketing',      'expense', 70),
  ('Rent',           'expense', 80),
  ('Utilities',      'expense', 85),
  ('Software',       'expense', 88),
  ('Other expense',  'expense', 95)
) as seed(name, kind, sort_order)
where not exists (select 1 from public.categories);

-- ---------------------------------------------------------------------------
-- Storage: private `receipts` bucket
-- ---------------------------------------------------------------------------
-- Private. Files are read via a URL signed in the CLICK handler (60s TTL) —
-- never a URL baked into server-rendered HTML, which is stale by construction
-- and reads to the user as "the button does nothing".

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select
  to authenticated using (bucket_id = 'receipts');

drop policy if exists receipts_write on storage.objects;
create policy receipts_write on storage.objects for insert
  to authenticated with check (bucket_id = 'receipts');

drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects for update
  to authenticated using (bucket_id = 'receipts');

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete
  to authenticated using (bucket_id = 'receipts');
