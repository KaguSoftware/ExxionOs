-- 0012_product_stock.sql — how many finished units exist, and why.
--
-- 0007 answers "how much filament is left". This answers the other half: a
-- print run turns filament INTO units, an order takes units OUT, and until now
-- nothing counted them. The shop has been guessing at "do we have three of
-- those on the shelf" — the one question a stock system exists to answer.

-- ---------------------------------------------------------------------------
-- print_runs.outcome — not every print is sellable
-- ---------------------------------------------------------------------------
-- ⚠️ ALL THREE OUTCOMES DEDUCT FILAMENT. A failed print burns real material;
-- stock that ignored failures would read high, which is the direction that
-- causes an order to be promised against plastic that does not exist.
-- Only `good` adds sellable units. Splitting the two makes waste a queryable
-- number ("how much did we spend on failures last month") rather than a
-- feeling, and costs nothing to record since the run is already being logged.
--
-- Default `good`: true of every existing row by definition — the column did
-- not exist, so nobody could have logged a failure.

alter table public.print_runs
  add column if not exists outcome text not null default 'good'
    check (outcome in ('good', 'test', 'failed'));

-- ---------------------------------------------------------------------------
-- product_stock_movements — an append-only ledger, not a counter
-- ---------------------------------------------------------------------------
-- ⚠️ ON-HAND IS `sum(delta)`, NEVER A STORED COLUMN. This is the same rule
-- 0004 applies to product cost, for the same reason: a cached total is wrong
-- the moment anything behind it changes, and nothing tells you it went wrong.
-- A ledger also answers WHY stock is what it is — "printed 10, sold 7, gave
-- away 1" — which a counter fundamentally cannot.

create table if not exists public.product_stock_movements (
  id          uuid primary key default gen_random_uuid(),

  -- cascade: a deleted product's stock history is about a thing that no longer
  -- exists. Unlike order_lines (which records that money changed hands), this
  -- table has no meaning without its product.
  product_id  uuid not null references public.products (id) on delete cascade,

  -- Signed. Positive adds units, negative removes them. A single signed column
  -- beats separate in/out columns: `sum(delta)` is the whole query.
  delta       integer not null check (delta <> 0),

  reason      text not null
    check (reason in ('print_run', 'order', 'sample', 'correction')),

  -- The row that caused this, when there is one. Loose pair, no FK — the same
  -- shape as transactions.source_* (0003) — because it points into three
  -- different tables and a real FK would need three nullable columns.
  -- Null is normal and means `correction`: a human counted the shelf.
  source_id   uuid,

  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  -- ⚠️ HOW MANY TIMES THIS SOURCE HAS ALREADY MOVED THIS PRODUCT IN THIS
  -- DIRECTION. The first shipment is negative-0; the un-ship that follows is
  -- positive-0; a re-ship is negative-1. Passed in by the caller — see
  -- `lib/stock-write.ts`, which computes it by counting prior movements of the
  -- same sign.
  --
  -- ⚠️ SEQUENCE AND SIGN ARE BOTH NEEDED, and the two obvious simplifications
  -- are both wrong:
  --   · Sign alone: an order can be shipped, dragged back, and shipped again.
  --     The second deduction looks identical to the first and gets rejected —
  --     the units come back and never leave.
  --   · Sequence alone: a deduction and its reversal are both the 0th of their
  --     kind, so the reversal would collide with the deduction it undoes.
  apply_seq   integer not null default 0 check (apply_seq >= 0),

  -- Generated, not passed in: deriving it here means the application cannot
  -- disagree with the delta it describes.
  delta_sign  smallint generated always as (sign(delta)) stored
);

-- ⚠️ THE IDEMPOTENCY GUARANTEE. Modelled on transactions_recurring_once_idx
-- (0003), which exists because two tabs racing produced duplicate rent.
--
-- The risk here is sharper: the shipping board is DRAG-AND-DROP, so a
-- double-drag onto `shipped` is a normal hand slip, and it must not deduct
-- stock twice. This makes that impossible in the database rather than hoping
-- the application wins the race.
--
-- ⚠️ `product_id` IS PART OF THE KEY. An order with two different products
-- writes two movements from ONE source id; without the product in the key the
-- second line would be rejected as a duplicate and that product's stock would
-- silently never move. Multi-line orders are ordinary, so this is not an edge
-- case.
--
-- `where source_id is not null` keeps corrections free to repeat: counting the
-- same shelf twice in one day is legitimate and must not be blocked.
create unique index if not exists product_stock_movements_once_idx
  on public.product_stock_movements
     (reason, source_id, product_id, delta_sign, apply_seq)
  where source_id is not null;

-- The query this table exists to serve: every movement for one product,
-- newest first.
create index if not exists product_stock_movements_product_idx
  on public.product_stock_movements (product_id, created_at desc);

alter table public.product_stock_movements enable row level security;

drop policy if exists product_stock_movements_all on public.product_stock_movements;
create policy product_stock_movements_all on public.product_stock_movements for all
  to authenticated using (true) with check (true);

-- Realtime, guarded the same way 0011 does it — the publication may not exist
-- on a bare local database, and that must not fail the migration.
do $$
begin
  alter publication supabase_realtime add table public.product_stock_movements;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;
