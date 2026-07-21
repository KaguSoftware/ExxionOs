-- 0008_shipping.sql — Shipping: clients, orders, lines, stage events, payments.
--
-- ⚠️ THIS IS THE REVENUE HALF OF THE SYSTEM.
-- Phases 1-4 only ever recorded money going OUT: Finance holds the ledger,
-- Creative computes what a product costs to make, Equipment writes a real
-- expense when something breaks. Nothing recorded money coming IN. Orders are
-- the first `direction:'in'` writer into the `transactions` contract (0003).
--
-- ⚠️ READ THIS BEFORE TOUCHING THE MONEY COLUMNS.
-- `orders.total_minor` is the AGREED PRICE. `order_payments` is the MONEY.
-- They are not the same number and must never be treated as one:
--   * A quoted order that is never paid has a total and no payments. Summing
--     totals would book it as revenue the shop never received.
--   * Exxion takes DEPOSITS (confirmed by Parsa, 2026-07-21), so an order is
--     commonly paid in two parts. "Log the total when it ships" would either
--     ignore the deposit already banked or count it twice.
-- The rule: THE STAGE IS THE WORK; THE PAYMENT IS THE MONEY. Reaching
-- `delivered` prompts for the OUTSTANDING BALANCE (total minus payments so
-- far); it never blindly writes the total. Revenue is always read from
-- `transactions`, exactly as machine spend is (see 0005).

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
-- Built in Phase 5 although Clients is Phase 6, deliberately: orders need a
-- real foreign key from day one. Storing a buyer as loose text now would mean
-- a data migration later, and the CRM in Phase 6 would be built on strings
-- instead of rows. Phase 6 ADDS COLUMNS AND SURFACES here; it does not
-- reshape this table.

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  instagram   text,
  city        text,
  notes       text,
  -- Archive, never delete: orders reference clients, and a past sale must not
  -- lose the name it was sold to.
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function private.set_updated_at();

create index if not exists clients_name_idx
  on public.clients (name)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),

  -- A short human reference ("EX-014") to say out loud on the phone. Generated
  -- in the action, not by a sequence, so it stays readable and editable.
  code                 text,

  -- ⚠️ SET NULL, not cascade. A walk-in has no client at all (hence nullable),
  -- and deleting a client must never delete the order or the revenue it
  -- produced — that money really was received.
  client_id            uuid references public.clients (id) on delete set null,

  -- The lifecycle. `cancelled` is terminal and deliberately part of the same
  -- column: an enquiry that never converts must leave the active board without
  -- being deleted, or the lost-quote rate is unknowable.
  stage                text not null default 'enquiry'
                         check (stage in ('enquiry', 'quoted', 'printing',
                                          'post_processing', 'packed',
                                          'shipped', 'delivered', 'cancelled')),

  title                text not null default '',
  notes                text,

  -- ⚠️ THE AGREED PRICE, NOT REVENUE. See the header. Never sum this column
  -- for income; sum `transactions` where source_type = 'order'.
  total_minor          bigint not null default 0 check (total_minor >= 0),

  promised_on          date,

  -- Plain fields by decision — no carrier API integration.
  carrier              text,
  tracking_number      text,
  shipping_cost_minor  bigint check (shipping_cost_minor is null
                                     or shipping_cost_minor >= 0),

  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create index if not exists orders_stage_idx on public.orders (stage, promised_on);
create index if not exists orders_client_idx on public.orders (client_id);

-- ---------------------------------------------------------------------------
-- order_lines — what makes per-collection P&L a real query
-- ---------------------------------------------------------------------------
-- Deferred since Phase 3 with "once orders exist (Phase 5)". A line points at
-- a Creative product, so real revenue finally meets computed cost.

create table if not exists public.order_lines (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,

  -- ⚠️ SET NULL, not cascade. Deleting a product from Creative must not delete
  -- the record that it was sold — that would rewrite a past order's contents
  -- and silently change what a month earned.
  product_id       uuid references public.products (id) on delete set null,

  -- Denormalised AT WRITE TIME so the line still reads after the product is
  -- gone (or renamed). Without this, a set-null link leaves a blank row.
  description      text not null default '',

  quantity         integer not null default 1 check (quantity > 0),
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists order_lines_order_idx
  on public.order_lines (order_id, sort_order);
create index if not exists order_lines_product_idx
  on public.order_lines (product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- order_stage_events — append-only, and why
-- ---------------------------------------------------------------------------
-- `orders.stage` answers "where is it now" fast. This table answers "when did
-- it get there", which is a different question and the one that makes
-- cycle-time free: "how long do quotes sit before printing" is a query over
-- consecutive rows, not a field anyone has to maintain by hand.
--
-- ⚠️ Both are written on every transition. Updating the column without
-- appending here loses the history silently.

create table if not exists public.order_stage_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  stage      text not null
               check (stage in ('enquiry', 'quoted', 'printing',
                                'post_processing', 'packed', 'shipped',
                                'delivered', 'cancelled')),
  entered_at timestamptz not null default now(),
  note       text,
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists order_stage_events_order_idx
  on public.order_stage_events (order_id, entered_at);

-- ---------------------------------------------------------------------------
-- order_payments — THE MONEY
-- ---------------------------------------------------------------------------
-- Each row is a real receipt of money and writes one Finance income
-- transaction. Deposits are normal for Exxion, so an order routinely has two:
-- a 'deposit' up front and a 'balance' at delivery.

create table if not exists public.order_payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  paid_on        date not null,

  -- Positive magnitude. A refund carries kind='refund' and is written to
  -- Finance as an OUT transaction — the same "magnitude + direction" rule the
  -- transactions table itself uses (0003), so the two never disagree.
  amount_minor   bigint not null check (amount_minor > 0),

  kind           text not null default 'balance'
                   check (kind in ('deposit', 'balance', 'refund')),

  -- ⚠️ SET NULL, matching maintenance_logs (0005). Deleting the Finance row
  -- must not erase the record that a client paid.
  transaction_id uuid references public.transactions (id) on delete set null,

  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists order_payments_order_idx
  on public.order_payments (order_id, paid_on desc);

-- ---------------------------------------------------------------------------
-- Sales category — so income has somewhere to land
-- ---------------------------------------------------------------------------
-- Seeded here rather than only created on demand, matching how 0003 seeded
-- Maintenance and Equipment. The action still creates it if missing, so a
-- database restored without seeds keeps working.

insert into public.categories (name, kind, sort_order)
select 'Sales', 'income', 10
where not exists (
  select 1 from public.categories where name = 'Sales'
);

-- ---------------------------------------------------------------------------
-- RLS — two trusted users, so the domain policy is simply "authenticated".
-- RLS being ON is what stops the anon key.
-- ---------------------------------------------------------------------------

alter table public.clients            enable row level security;
alter table public.orders             enable row level security;
alter table public.order_lines        enable row level security;
alter table public.order_stage_events enable row level security;
alter table public.order_payments     enable row level security;

drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients for all
  to authenticated using (true) with check (true);

drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all
  to authenticated using (true) with check (true);

drop policy if exists order_lines_all on public.order_lines;
create policy order_lines_all on public.order_lines for all
  to authenticated using (true) with check (true);

drop policy if exists order_stage_events_all on public.order_stage_events;
create policy order_stage_events_all on public.order_stage_events for all
  to authenticated using (true) with check (true);

drop policy if exists order_payments_all on public.order_payments;
create policy order_payments_all on public.order_payments for all
  to authenticated using (true) with check (true);
