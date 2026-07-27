-- 0025_inspiration.sql — the Inspiration section: boards, pin images, and the
-- four columns that turn an idea into a pin.
--
-- ⚠️⚠️ A PIN AND AN IDEA ARE ONE RECORD. There is deliberately no `pins` table.
-- The masonry board and the text list are two LENSES over `ideas`, the same
-- discipline as `issues` → Learnings (0004) and `events` → the Marketing
-- schedule (0009). A pin is an idea whose content is mainly a picture; a
-- text-only idea still works; and promoting either into a collection is still
-- the same `promoteIdea`. Two tables would mean the same thought gets entered
-- twice and neither list is ever complete.
--
-- ⚠️ `ideas` MOVES OWNERSHIP in this migration: it is read by /inspiration, and
-- /creative stops querying it entirely. Adding an `ideas` query back into the
-- creative wave would resurrect the coupling this migration exists to remove.

-- ---------------------------------------------------------------------------
-- boards — the folders of the masonry
-- ---------------------------------------------------------------------------

create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,

  -- A storage path in the existing `creative` bucket, chosen from one of the
  -- board's own pins ("set as cover"). Nullable and never load-bearing — a
  -- board with no cover renders a mosaic of its newest pins instead.
  cover_path  text,

  -- ⚠️ ARCHIVE, NOT DELETE — the same discipline as `categories` (0003) and
  -- `vocabularies` (0011). An archived board stops being offered in the picker
  -- but keeps naming the pins already filed under it.
  archived_at timestamptz,

  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function private.set_updated_at();

create index if not exists boards_live_idx
  on public.boards (created_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- ideas — grows four columns
-- ---------------------------------------------------------------------------

-- ⚠️ SET NULL, NEVER CASCADE. Deleting a board must not delete the pictures you
-- collected into it — they fall back to the "unsorted" lens. Same reasoning as
-- issues surviving their collection (0004) and events surviving their client
-- (0009).
alter table public.ideas
  add column if not exists board_id uuid references public.boards (id) on delete set null;

-- Free-form, cross-cutting, label-not-FK — the exact contract `clients.tags`
-- uses (0009). The `idea_tag` vocabulary registered below only REMEMBERS the
-- spellings; the value stored here is the label itself.
alter table public.ideas
  add column if not exists tags text[] not null default '{}';

-- 0023 gave `links` to seven tables but not this one. A pin is the entity that
-- most obviously has URLs hanging off it, so it gets the same column and the
-- same normaliseLinks() contract (src/lib/links.ts).
alter table public.ideas
  add column if not exists links text[] not null default '{}';

-- ⚠️ `source_url` IS PROVENANCE, `links` IS REFERENCES. One value, written by
-- the URL capture, never hand-edited — where this picture came from. Keeping
-- them separate is what makes "open the original" work on a link-only pin (one
-- whose site refused to hand over its image), where `links` may be empty or may
-- hold something else entirely.
alter table public.ideas
  add column if not exists source_url text;

create index if not exists ideas_board_idx
  on public.ideas (board_id, created_at desc);

create index if not exists ideas_tags_gin
  on public.ideas using gin (tags);

-- ---------------------------------------------------------------------------
-- idea_images — mirrors product_images, plus intrinsic dimensions
-- ---------------------------------------------------------------------------
--
-- ⚠️ `width`/`height` ARE THE ONE DELIBERATE DIFFERENCE from product_images
-- (0004), and they are not decoration. A masonry of unknown-ratio pictures
-- reflows violently while forty signed thumbnail URLs resolve at forty
-- different moments. Storing the intrinsic size lets each card reserve its
-- exact box via `style={{ aspectRatio }}` BEFORE its image arrives, so the
-- column heights are correct on first paint and never jump.
--
-- Nullable, because a failed decode must not block the attach — the card falls
-- back to a 4:5 box and the pin still exists. Never make these NOT NULL.

create table if not exists public.idea_images (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  path       text not null,
  sort_order integer not null default 0,
  width      integer check (width  is null or width  > 0),
  height     integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index if not exists idea_images_parent_idx
  on public.idea_images (idea_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS — two trusted users, so the domain policy is the standing one. RLS being
-- *on* is what stops the anon key; it is not doing per-user work here.
-- ---------------------------------------------------------------------------

alter table public.boards      enable row level security;
alter table public.idea_images enable row level security;

drop policy if exists boards_all on public.boards;
create policy boards_all on public.boards for all
  to authenticated using (true) with check (true);

drop policy if exists idea_images_all on public.idea_images;
create policy idea_images_all on public.idea_images for all
  to authenticated using (true) with check (true);

-- ⚠️ NO STORAGE CHANGES. Pin images live at `idea/<idea_id>/<uuid>.<ext>` in
-- the existing `creative` bucket, whose four policies are bucket-scoped to
-- `authenticated` (0004). 0020 relied on exactly this for product_files.

-- ---------------------------------------------------------------------------
-- vocabularies.kind — widen for `idea_tag`
-- ---------------------------------------------------------------------------
-- Same shape as 0022. `ideas.tags` stays text[]; this only registers the kind
-- so the pin composer can offer the type-to-create picker.

alter table public.vocabularies
  drop constraint if exists vocabularies_kind_check;

alter table public.vocabularies
  add constraint vocabularies_kind_check
    check (kind in ('product_type', 'client_tag', 'supply_type', 'supply_item',
                    'machine_kind', 'idea_tag'));

insert into public.vocabularies (kind, label, slug, sort_order)
select * from (values
  ('idea_tag', 'Colour',    'colour',    10),
  ('idea_tag', 'Form',      'form',      20),
  ('idea_tag', 'Packaging', 'packaging', 30),
  ('idea_tag', 'Texture',   'texture',   40),
  ('idea_tag', 'Reference', 'reference', 50)
) as seed(kind, label, slug, sort_order)
where not exists (
  select 1 from public.vocabularies where kind = 'idea_tag'
);

-- ---------------------------------------------------------------------------
-- realtime — `<LiveRefresh tables={["boards", "idea_images", …]} />` only
-- receives events for tables in the publication. Guarded exactly like 0011.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'boards'
  ) then
    alter publication supabase_realtime add table public.boards;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'idea_images'
  ) then
    alter publication supabase_realtime add table public.idea_images;
  end if;
exception
  -- No publication in this environment (a bare local database) — realtime is
  -- simply unavailable there, which must not fail the migration.
  when undefined_object then null;
end $$;
