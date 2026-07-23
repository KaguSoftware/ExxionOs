-- Business identity (invoices), labour costing, monthly revenue target, and the
-- Instagram content pipeline. All additive.

-- app_settings is the single-row (id=1) settings table.
alter table public.app_settings
  add column if not exists business_name      text,
  add column if not exists business_address   text,
  add column if not exists business_phone     text,
  add column if not exists business_email      text,
  add column if not exists business_instagram  text,
  add column if not exists invoice_footer      text,
  -- Human time on a piece (post-processing, painting). Feeds productCost the
  -- same way the machine rate does. Zero by default so nothing changes until a
  -- rate is set.
  add column if not exists labor_hour_rate_minor bigint not null default 0
    check (labor_hour_rate_minor >= 0),
  -- ⚠️ NULLABLE, and null is a real answer: "no target set" is not "target of
  -- ₺0". The dashboard renders a "set a target" hint rather than a full bar.
  add column if not exists monthly_target_minor  bigint;

-- products: labour time per unit + Instagram posted date.
alter table public.products
  -- Postgres numeric, like grams/print_hours; null = not costed for labour.
  add column if not exists labor_hours numeric
    check (labor_hours is null or labor_hours >= 0),
  -- Null = not posted yet. The content pipeline groups on this.
  add column if not exists posted_on date;
