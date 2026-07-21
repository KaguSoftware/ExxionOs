-- 0004_creative.sql — Creative hub: ideas, collections, products, issues/learnings.
--
-- The point of this section, in Parsa's words: "keeps us consistent". That only
-- works if an issue CANNOT fail to appear in Learnings — hence one `issues`
-- table with two lenses (a collection's tab, and the app-wide list), never two
-- tables someone has to remember to copy between.

-- ---------------------------------------------------------------------------
-- materials  +  app_settings   (the inputs to computed product cost)
-- ---------------------------------------------------------------------------

create table if not exists public.materials (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  kind              text not null default 'filament'
                      check (kind in ('filament', 'resin', 'other')),
  -- Integer kuruş per kilogram. Same rule as everywhere else in this app:
  -- money is an exact integer, never a float. See src/lib/money.ts.
  cost_per_kg_minor bigint not null default 0 check (cost_per_kg_minor >= 0),
  color             text,
  notes             text,
  -- ⚠️ ARCHIVE, NEVER DELETE — a deleted material would null out every
  -- product's material_id and silently re-cost the whole catalogue.
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function private.set_updated_at();

-- Single-row settings. The `check (id = 1)` is what makes it single-row: there
-- is no "which settings row?" ambiguity, ever.
create table if not exists public.app_settings (
  id                      integer primary key default 1 check (id = 1),
  machine_hour_rate_minor bigint not null default 0
                            check (machine_hour_rate_minor >= 0),
  updated_at              timestamptz not null default now()
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function private.set_updated_at();

insert into public.app_settings (id, machine_hour_rate_minor)
values (1, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- collections — the "folders" of the Projects tab
-- ---------------------------------------------------------------------------

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text not null default 'planned'
                check (status in ('planned', 'in_progress', 'done', 'archived')),
  cover_path  text,
  started_on  date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function private.set_updated_at();

create index if not exists collections_status_idx
  on public.collections (status, created_at desc);

-- ---------------------------------------------------------------------------
-- ideas — capture, and promotable into a collection
-- ---------------------------------------------------------------------------

create table if not exists public.ideas (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,
  status        text not null default 'new'
                  check (status in ('new', 'exploring', 'dropped', 'made')),
  -- Set when the idea is promoted, so you can see which collections began as
  -- ideas. `set null` — deleting the collection must not delete the idea.
  collection_id uuid references public.collections (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at
  before update on public.ideas
  for each row execute function private.set_updated_at();

create index if not exists ideas_status_idx on public.ideas (status, created_at desc);

-- ---------------------------------------------------------------------------
-- products — the styles inside a collection (keychains, vases, coasters…)
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  -- CASCADE here is right: a product has no meaning without its collection.
  -- (Contrast with issues below, which deliberately survive.)
  collection_id uuid not null references public.collections (id) on delete cascade,
  name          text not null,
  -- Free text, NOT an enum: the vocabulary of shapes will keep growing, and a
  -- CHECK constraint would mean a migration every time you print a new thing.
  kind          text,
  material_id   uuid references public.materials (id) on delete set null,

  -- ⚠️ THE COST INPUTS. Cost itself is NOT a column — it is computed at read
  -- time from these plus the material's rate and the machine rate. A stored
  -- cost goes stale the moment a filament price changes, leaving a table of
  -- numbers that are quietly wrong. See src/lib/costing.ts.
  grams         numeric(10, 2),
  print_hours   numeric(10, 2),

  price_minor   bigint check (price_minor is null or price_minor >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create index if not exists products_collection_idx
  on public.products (collection_id, created_at);

-- ---------------------------------------------------------------------------
-- issues — THE LEARNINGS SPINE
-- ---------------------------------------------------------------------------

create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,

  -- ⚠️ BOTH NULLABLE, BOTH `on delete set null` — NOT cascade.
  -- Deleting a collection must NEVER delete the lessons learned making it.
  -- That knowledge outlives the project; it is the entire reason this section
  -- exists ("keeps us consistent"). An issue with a null collection is still a
  -- perfectly good learning — it just no longer names where it happened.
  collection_id uuid references public.collections (id) on delete set null,
  product_id    uuid references public.products (id) on delete set null,

  severity      text not null default 'medium'
                  check (severity in ('low', 'medium', 'high')),

  -- ⚠️ `resolution` IS THE SOLVED STATE. There is deliberately no separate
  -- boolean: a status flag plus a written fix would drift, and an issue marked
  -- "solved" with no explanation teaches nobody — which defeats the point.
  resolution    text,
  resolved_at   timestamptz,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists issues_set_updated_at on public.issues;
create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function private.set_updated_at();

create index if not exists issues_collection_idx
  on public.issues (collection_id, created_at desc);
-- Partial index for the Learnings default view: unsolved first.
create index if not exists issues_unresolved_idx
  on public.issues (created_at desc)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- images
-- ---------------------------------------------------------------------------

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_images (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references public.issues (id) on delete cascade,
  path       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_parent_idx
  on public.product_images (product_id, sort_order);
create index if not exists issue_images_parent_idx
  on public.issue_images (issue_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS — enabled everywhere; two trusted users, so the policies are simple.
-- ---------------------------------------------------------------------------

alter table public.materials      enable row level security;
alter table public.app_settings   enable row level security;
alter table public.collections    enable row level security;
alter table public.ideas          enable row level security;
alter table public.products       enable row level security;
alter table public.issues         enable row level security;
alter table public.product_images enable row level security;
alter table public.issue_images   enable row level security;

drop policy if exists materials_all on public.materials;
create policy materials_all on public.materials for all
  to authenticated using (true) with check (true);

drop policy if exists app_settings_all on public.app_settings;
create policy app_settings_all on public.app_settings for all
  to authenticated using (true) with check (true);

drop policy if exists collections_all on public.collections;
create policy collections_all on public.collections for all
  to authenticated using (true) with check (true);

drop policy if exists ideas_all on public.ideas;
create policy ideas_all on public.ideas for all
  to authenticated using (true) with check (true);

drop policy if exists products_all on public.products;
create policy products_all on public.products for all
  to authenticated using (true) with check (true);

drop policy if exists issues_all on public.issues;
create policy issues_all on public.issues for all
  to authenticated using (true) with check (true);

drop policy if exists product_images_all on public.product_images;
create policy product_images_all on public.product_images for all
  to authenticated using (true) with check (true);

drop policy if exists issue_images_all on public.issue_images;
create policy issue_images_all on public.issue_images for all
  to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage: private `creative` bucket (product + issue photos)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('creative', 'creative', false)
on conflict (id) do nothing;

drop policy if exists creative_read on storage.objects;
create policy creative_read on storage.objects for select
  to authenticated using (bucket_id = 'creative');

drop policy if exists creative_write on storage.objects;
create policy creative_write on storage.objects for insert
  to authenticated with check (bucket_id = 'creative');

drop policy if exists creative_update on storage.objects;
create policy creative_update on storage.objects for update
  to authenticated using (bucket_id = 'creative');

drop policy if exists creative_delete on storage.objects;
create policy creative_delete on storage.objects for delete
  to authenticated using (bucket_id = 'creative');
