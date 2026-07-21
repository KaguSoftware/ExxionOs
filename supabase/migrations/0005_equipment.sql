-- 0005_equipment.sql — Equipment: machines, maintenance, supplies.
--
-- ⚠️ THIS IS THE FIRST REAL WRITER INTO THE `transactions` CONTRACT.
-- Migration 0003 gave transactions a polymorphic `source_type` / `source_id`
-- precisely so a repair logged here becomes a genuine Finance expense tagged
-- back to the machine that needed it. Parsa's words: "this page is the real
-- place where it should have a strong link to the finances tab."

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------

create table if not exists public.machines (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  -- Free text, not an enum: the shop will buy kinds of machine nobody listed
  -- today, and a CHECK would mean a migration each time.
  kind                 text,
  model                text,
  serial               text,

  -- The "mark it broken" surface Parsa asked for.
  -- ⚠️ `needs_attention` earns its place: it is how you record "it prints but
  -- the belt is slipping" BEFORE that becomes downtime. A binary
  -- working/broken flag has nowhere to put the most useful state.
  status               text not null default 'operational'
                         check (status in ('operational', 'needs_attention',
                                           'broken', 'retired')),

  location             text,
  purchased_on         date,
  purchase_price_minor bigint check (purchase_price_minor is null
                                     or purchase_price_minor >= 0),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists machines_set_updated_at on public.machines;
create trigger machines_set_updated_at
  before update on public.machines
  for each row execute function private.set_updated_at();

create index if not exists machines_status_idx on public.machines (status, name);

-- ---------------------------------------------------------------------------
-- maintenance_logs — the Finance writer
-- ---------------------------------------------------------------------------

create table if not exists public.maintenance_logs (
  id             uuid primary key default gen_random_uuid(),
  -- CASCADE: a maintenance entry has no meaning without its machine.
  machine_id     uuid not null references public.machines (id) on delete cascade,
  performed_on   date not null,
  kind           text not null default 'repair'
                   check (kind in ('repair', 'service', 'part', 'inspection')),
  description    text not null default '',

  -- Nullable on purpose: an inspection that cost nothing is a real event and
  -- should not be forced to record ₺0.
  cost_minor     bigint check (cost_minor is null or cost_minor >= 0),

  -- ⚠️ `on delete SET NULL`, NOT cascade. Deleting the Finance row must never
  -- delete the maintenance history — the repair still happened. The log then
  -- simply has no linked expense, which is the honest state. (Same reasoning
  -- as issues.collection_id in 0004: the record outlives the link.)
  transaction_id uuid references public.transactions (id) on delete set null,

  performed_by   uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists maintenance_logs_set_updated_at on public.maintenance_logs;
create trigger maintenance_logs_set_updated_at
  before update on public.maintenance_logs
  for each row execute function private.set_updated_at();

create index if not exists maintenance_logs_machine_idx
  on public.maintenance_logs (machine_id, performed_on desc);

-- ---------------------------------------------------------------------------
-- supplies + restocks
-- ---------------------------------------------------------------------------

create table if not exists public.supplies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  unit              text not null default 'pcs',
  -- numeric, not integer: some supplies are measured in litres or grams.
  quantity          numeric(12, 2) not null default 0,
  -- "Warn me below this." Nullable = never warn, which is right for something
  -- you buy on demand rather than keep stocked.
  low_threshold     numeric(12, 2),
  last_price_minor  bigint check (last_price_minor is null or last_price_minor >= 0),
  notes             text,
  -- Archive, never delete: restock history references it.
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists supplies_set_updated_at on public.supplies;
create trigger supplies_set_updated_at
  before update on public.supplies
  for each row execute function private.set_updated_at();

-- Partial index for the "what am I about to run out of" query, which is the
-- one this table exists to answer.
create index if not exists supplies_low_idx
  on public.supplies (name)
  where archived_at is null and low_threshold is not null;

create table if not exists public.supply_restocks (
  id             uuid primary key default gen_random_uuid(),
  supply_id      uuid not null references public.supplies (id) on delete cascade,
  restocked_on   date not null,
  quantity       numeric(12, 2) not null default 0,
  cost_minor     bigint check (cost_minor is null or cost_minor >= 0),
  -- Same set-null contract as maintenance_logs.
  transaction_id uuid references public.transactions (id) on delete set null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists supply_restocks_supply_idx
  on public.supply_restocks (supply_id, restocked_on desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.machines         enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.supplies         enable row level security;
alter table public.supply_restocks  enable row level security;

drop policy if exists machines_all on public.machines;
create policy machines_all on public.machines for all
  to authenticated using (true) with check (true);

drop policy if exists maintenance_logs_all on public.maintenance_logs;
create policy maintenance_logs_all on public.maintenance_logs for all
  to authenticated using (true) with check (true);

drop policy if exists supplies_all on public.supplies;
create policy supplies_all on public.supplies for all
  to authenticated using (true) with check (true);

drop policy if exists supply_restocks_all on public.supply_restocks;
create policy supply_restocks_all on public.supply_restocks for all
  to authenticated using (true) with check (true);
