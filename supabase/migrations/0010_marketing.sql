-- 0010_marketing.sql — Marketing: campaigns, their spend, and free samples.
--
-- The last of the seven sections. Two rules govern everything here, and both
-- are inherited rather than invented:
--
-- ⚠️ 1. A FREE SAMPLE IS COSTED, NEVER EXPENSED.
--    A sample points at a Creative product, so `productCost()` already knows
--    what it cost to make (filament + machine time). NOTHING in this migration
--    writes a Finance transaction for a sample, and the actions must not
--    either: the filament was expensed when it was BOUGHT. Writing another row
--    when it is given away counts the same lira twice. This is the identical
--    rule Phase 3 applied to products ("no transaction is written when a
--    product is costed") and Phase 4 applied to machine purchase prices.
--    What a sample MAY do, if it was physically printed for the occasion, is
--    deduct filament through a PRINT RUN (0007) — the real-world event that
--    empties a spool.
--
-- ⚠️ 2. `campaigns.budget_minor` IS THE PLAN. `transactions` IS THE MONEY.
--    Exactly the relationship `orders.total_minor` has to `order_payments`
--    (0008), and `maintenance_logs.cost_minor` has to its transaction (0005).
--    Never sum the budget to report what marketing cost — a campaign that was
--    planned at ₺5.000 and never ran spent ₺0. Actual spend is the sum of the
--    `transactions` rows tagged source_type='marketing'.
--
-- ⚠️ NOTE WHAT IS *NOT* HERE: the `events` table is untouched. Its CHECK has
-- accepted 'filming', 'networking' and 'campaign' since 0009, deliberately, so
-- that the Marketing schedule is a second LENS over existing rows — the same
-- relationship Learnings has to `issues` — and not a second table to keep in
-- sync. One table cannot drift from itself.

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '',

  -- CHECK-constrained text rather than an enum, matching `orders.stage` (0008)
  -- and `clients.kind` (0009): adding a channel later is a two-line
  -- `alter constraint`, not an `alter type` that locks the table.
  channel      text not null default 'instagram',
  status       text not null default 'planned',

  goal         text,

  -- ⚠️ THE PLAN, NOT THE MONEY. See the header. Zero is a real value meaning
  -- "no budget set", which is why the UI reports usage as NULL rather than 0%
  -- for it — "0% of budget used" reads as headroom that does not exist.
  budget_minor bigint not null default 0 check (budget_minor >= 0),

  starts_on    date,
  ends_on      date,
  notes        text,

  -- ⚠️ ARCHIVE, NEVER DELETE — costs and samples point here, and a past
  -- campaign is what explains a past month's spend.
  archived_at  timestamptz,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.campaigns drop constraint if exists campaigns_channel_check;
alter table public.campaigns add constraint campaigns_channel_check
  check (channel in ('instagram', 'tiktok', 'market', 'collab', 'print', 'other'));

-- 'cancelled' is terminal and lives in the same column as the working states,
-- for the same reason `orders.stage` does: a campaign that was called off must
-- leave the active list without being deleted, or you cannot tell how many
-- plans never happened.
alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check
  check (status in ('planned', 'running', 'done', 'cancelled'));

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function private.set_updated_at();

create index if not exists campaigns_status_idx
  on public.campaigns (status, starts_on)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- campaign_costs — the itemised spend, and the third writer into `transactions`
-- ---------------------------------------------------------------------------
-- Itemised rather than one `spend_minor` column on the campaign, because a
-- shoot is a location fee plus a model plus props: a single number cannot be
-- corrected without re-deriving it by hand, and cannot be traced in Finance.

create table if not exists public.campaign_costs (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,

  label          text not null default '',
  amount_minor   bigint not null check (amount_minor > 0),
  spent_on       date not null,

  -- ⚠️ SET NULL, matching maintenance_logs (0005) and order_payments (0008):
  -- deleting the Finance row must not erase the record that it was spent.
  -- ⚠️ AND IT IS THE ONLY LINK. `syncTransaction()` returns the id; the action
  -- MUST store it here, or the next edit creates a SECOND transaction instead
  -- of updating the first.
  transaction_id uuid references public.transactions (id) on delete set null,

  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists campaign_costs_campaign_idx
  on public.campaign_costs (campaign_id, spent_on desc);

-- ---------------------------------------------------------------------------
-- samples — what was given away
-- ---------------------------------------------------------------------------

create table if not exists public.samples (
  id          uuid primary key default gen_random_uuid(),

  -- ⚠️ SET NULL, not cascade. Deleting a design from Creative must not delete
  -- the record that it was given to somebody.
  product_id  uuid references public.products (id) on delete set null,

  -- Denormalised AT WRITE TIME so the row still reads after the product is
  -- gone or renamed — exactly like `order_lines.description` (0008). Without
  -- this, a set-null link leaves a blank row nobody can interpret.
  description text not null default '',

  -- Both optional and both SET NULL: a sample handed to a stranger at a market
  -- has no client, and one sent as general goodwill has no campaign.
  client_id   uuid references public.clients (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,

  -- For the case where the recipient is not (yet) a client row.
  recipient   text,

  quantity    integer not null default 1 check (quantity > 0),
  given_on    date not null,
  notes       text,

  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists samples_given_idx on public.samples (given_on desc);
create index if not exists samples_campaign_idx on public.samples (campaign_id)
  where campaign_id is not null;
create index if not exists samples_client_idx on public.samples (client_id)
  where client_id is not null;

-- ---------------------------------------------------------------------------
-- Marketing category — so campaign spend has somewhere to land
-- ---------------------------------------------------------------------------
-- Seeded here as 0003 seeded Maintenance and 0008 seeded Sales. The action
-- still creates it on demand (`categoryIdByName`), so a database restored
-- without seeds keeps working rather than filing money with no category.

insert into public.categories (name, kind, sort_order)
select 'Marketing', 'expense', 20
where not exists (
  select 1 from public.categories where name = 'Marketing'
);

-- ---------------------------------------------------------------------------
-- RLS — two trusted users, so the domain policy is simply "authenticated".
-- RLS being ON is what stops the anon key.
-- ---------------------------------------------------------------------------

alter table public.campaigns      enable row level security;
alter table public.campaign_costs enable row level security;
alter table public.samples        enable row level security;

drop policy if exists campaigns_all on public.campaigns;
create policy campaigns_all on public.campaigns for all
  to authenticated using (true) with check (true);

drop policy if exists campaign_costs_all on public.campaign_costs;
create policy campaign_costs_all on public.campaign_costs for all
  to authenticated using (true) with check (true);

drop policy if exists samples_all on public.samples;
create policy samples_all on public.samples for all
  to authenticated using (true) with check (true);
