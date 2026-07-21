-- 0007_material_stock.sql — link a costing MATERIAL to a stocked SUPPLY, and
-- record print runs so filament is actually deducted.
--
-- ⚠️ WHY TWO TABLES STAY TWO TABLES.
-- `materials` (0004) answers "what does a gram of this cost?" — it exists for
-- costing. `supplies` (0005) answers "how much do I have left?" — it exists for
-- restocking. Filament is both, but gloves and boxes are only stock, and a
-- material you buy per-job has no stock at all. Merging them would force every
-- row to carry columns it doesn't use. A nullable link joins them exactly where
-- they ARE the same physical thing.

alter table public.materials
  add column if not exists supply_id uuid
    -- set null: deleting the spool you're tracking must not delete the price
    -- history that costed every product made from it.
    references public.supplies (id) on delete set null;

-- ---------------------------------------------------------------------------
-- print_runs — the event that actually consumes filament
-- ---------------------------------------------------------------------------
-- ⚠️ STOCK IS DEDUCTED PER RUN, NOT PER PRODUCT.
-- A product is a DESIGN — it is printed many times, or never. Deducting when
-- the product row is created would charge one unit's worth for a design you
-- may print fifty times, and stock would drift from reality immediately.
-- A print run is the real-world event, so it is the honest place to deduct.

create table if not exists public.print_runs (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  printed_on     date not null,
  units          integer not null default 1 check (units > 0),

  -- Snapshot of what was actually deducted. Kept even if the product's
  -- grams-per-unit changes later, so history stays true to what happened.
  grams_used     numeric(12, 2),
  -- Which supply it came out of, so a correction knows what to put back.
  supply_id      uuid references public.supplies (id) on delete set null,

  notes          text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists print_runs_product_idx
  on public.print_runs (product_id, printed_on desc);

alter table public.print_runs enable row level security;

drop policy if exists print_runs_all on public.print_runs;
create policy print_runs_all on public.print_runs for all
  to authenticated using (true) with check (true);
