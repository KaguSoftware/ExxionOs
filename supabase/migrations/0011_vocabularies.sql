-- 0011_vocabularies.sql — the REGISTRY of user-grown labels.
--
-- ⚠️ WHY THIS IS A REGISTRY AND NOT A FOREIGN KEY.
-- `products.kind` (0004) and `clients.tags` (0009) both carry a deliberate
-- comment saying they are free text so that inventing a new word never costs a
-- migration. That reasoning is still right, and this table does NOT overturn
-- it: `products.kind` stays text and `clients.tags` stays text[]. What was
-- actually missing is MEMORY — a word you typed once was never offered back,
-- so "Keychain", "keychain" and "keychain " all became separate vocabulary
-- nobody could see or tidy.
--
-- So: the columns keep storing LABELS, and this table remembers which labels
-- exist, in what spelling, and which ones have been retired. Nothing here can
-- orphan a product or a client — worst case a row references a label that was
-- archived, and it still reads correctly because the label IS the value.

create table if not exists public.vocabularies (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null
                check (kind in ('product_type', 'client_tag')),

  -- What the user actually typed, kept verbatim — this is what gets written
  -- onto products/clients and shown back in the UI.
  label       text not null,

  -- ⚠️ THE DEDUPE RULE, ENFORCED BY THE DATABASE RATHER THAN BY CONVENTION.
  -- lower(trim(collapse-internal-whitespace(label))). The unique index below
  -- makes `Key Chain`, `key chain` and `  KEY   CHAIN ` literally the same
  -- row, which is the "avoid duplicates with capitals, spaces, or just full on
  -- duplicates" requirement. Kept as a stored column, not an expression index,
  -- so the app can query and compare against it directly.
  slug        text not null,

  sort_order  integer not null default 50,

  -- ⚠️ ARCHIVE, NOT DELETE — same discipline as `categories` (0003). An
  -- archived word stops being offered in pickers but keeps explaining the rows
  -- that already use it. (A hard delete IS safe here in a way it is not for
  -- categories, because nothing holds an FK — but it would silently make an
  -- in-use word un-reofferable, which reads as data loss. The UI offers delete
  -- only when the word is genuinely unused.)
  archived_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists vocabularies_kind_slug_idx
  on public.vocabularies (kind, slug);

-- Partial, because every picker asks the same question: "the live words of
-- this kind, in order".
create index if not exists vocabularies_kind_sort_idx
  on public.vocabularies (kind, sort_order)
  where archived_at is null;

drop trigger if exists vocabularies_set_updated_at on public.vocabularies;
create trigger vocabularies_set_updated_at
  before update on public.vocabularies
  for each row execute function private.set_updated_at();

alter table public.vocabularies enable row level security;

drop policy if exists vocabularies_all on public.vocabularies;
create policy vocabularies_all on public.vocabularies for all
  to authenticated using (true) with check (true);

-- `<LiveRefresh tables={[… "vocabularies"]} />` on the creative and clients
-- pages only receives events if the table is in the realtime publication.
-- Guarded because the publication may already include it, and `add table` on a
-- member table is an error rather than a no-op.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vocabularies'
  ) then
    alter publication supabase_realtime add table public.vocabularies;
  end if;
exception
  -- No publication in this environment (a bare local database) — realtime is
  -- simply unavailable there, which must not fail the migration.
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill — adopt the vocabulary that already exists in the data
-- ---------------------------------------------------------------------------
-- ⚠️ THIS IS THE DELICATE PART. `products.kind` has only ever been normalised
-- as trim()+slice(60), so variant spellings of the same word are live data
-- right now. Collapsing them by slug is the whole point — but the collapse has
-- to pick ONE spelling to keep, and picking wrong means Parsa sees a word he
-- didn't write.
--
-- Rule: group by slug, keep the spelling used by the MOST rows; break ties
-- alphabetically so the result is deterministic rather than
-- whichever-row-postgres-read-first.
--
-- The product/client rows themselves are NOT rewritten. A product keeps the
-- exact string it had. The registry simply learns the words.

with normalised as (
  select
    -- Mirrors src/lib/vocab.ts exactly. If you change one, change the other.
    lower(regexp_replace(btrim(kind), '\s+', ' ', 'g')) as slug,
    btrim(kind)                                         as label
  from public.products
  where kind is not null and btrim(kind) <> ''
),
ranked as (
  select
    slug,
    label,
    row_number() over (
      partition by slug
      order by count(*) desc, label asc
    ) as rank
  from normalised
  group by slug, label
)
insert into public.vocabularies (kind, label, slug)
select 'product_type', label, slug
from ranked
where rank = 1
on conflict (kind, slug) do nothing;

-- Client tags are already lowercased and deduped by normaliseTags()
-- (src/lib/actions/clients.ts), so they collapse cleanly — but run them
-- through the same expression anyway rather than trusting that.
with normalised as (
  select
    lower(regexp_replace(btrim(tag), '\s+', ' ', 'g')) as slug,
    btrim(tag)                                         as label
  from public.clients, unnest(tags) as tag
  where btrim(tag) <> ''
),
ranked as (
  select
    slug,
    label,
    row_number() over (
      partition by slug
      order by count(*) desc, label asc
    ) as rank
  from normalised
  group by slug, label
)
insert into public.vocabularies (kind, label, slug)
select 'client_tag', label, slug
from ranked
where rank = 1
on conflict (kind, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed — only if the backfill found nothing at all
-- ---------------------------------------------------------------------------
-- A starting vocabulary for a 3D-printing shop, matching the placeholder that
-- the product form has shown all along ("Keychain, vase, coaster…"). Guarded
-- so it never fights real data or duplicates on re-run.

insert into public.vocabularies (kind, label, slug, sort_order)
select * from (values
  ('product_type', 'Keychain', 'keychain', 10),
  ('product_type', 'Vase',     'vase',     20),
  ('product_type', 'Coaster',  'coaster',  30),
  ('product_type', 'Figurine', 'figurine', 40),
  ('product_type', 'Sign',     'sign',     50)
) as seed(kind, label, slug, sort_order)
where not exists (
  select 1 from public.vocabularies where kind = 'product_type'
);
