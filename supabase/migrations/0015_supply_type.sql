-- 0015_supply_type.sql — supplies get a SEARCHABLE, USER-GROWN type.
--
-- ⚠️ WHY THIS REPLACES the fixed filament/resin/other `kind`.
-- Supplies are two things in one tab: printing materials (filament, resin —
-- costed per kg, deducted by grams) and packaging (cardboard, stickers, tape —
-- counted by piece, no per-kg cost). A three-value enum can't name "stickers",
-- and Parsa wants the same type-to-create picker the product form uses.
--
-- So `kind` (the enum) goes, and `type` (free text, verbatim) takes its place —
-- backed by a new `supply_type` vocabulary kind (registry, not FK), exactly
-- like `products.kind` is backed by `product_type` (0011).
--
-- The "is this a printing material?" signal is NOT a new column: a supply is a
-- printing material iff it has `cost_per_kg_minor` (added in 0014). Null cost =
-- packaging. costing.ts already treats a null price as uncosted, so this keeps
-- one source of truth.

-- ---------------------------------------------------------------------------
-- supplies: free-text type replaces the enum kind
-- ---------------------------------------------------------------------------
alter table public.supplies
  -- Verbatim category label, like products.kind. Nullable — an uncategorised
  -- supply is legal and lands in its own group in the UI.
  add column if not exists type text;

alter table public.supplies
  drop column if exists kind;

-- ---------------------------------------------------------------------------
-- vocabularies: allow the new kind
-- ---------------------------------------------------------------------------
-- Drop + recreate the CHECK to add 'supply_type'. The constraint name matches
-- what Postgres auto-generated for the inline check in 0011.
alter table public.vocabularies
  drop constraint if exists vocabularies_kind_check;

alter table public.vocabularies
  add constraint vocabularies_kind_check
    check (kind in ('product_type', 'client_tag', 'supply_type'));

-- ---------------------------------------------------------------------------
-- Seed — a starting vocabulary, only if none exists yet
-- ---------------------------------------------------------------------------
-- Guarded so it never fights real data or duplicates on re-run, same shape as
-- the product_type seed in 0011.
insert into public.vocabularies (kind, label, slug, sort_order)
select * from (values
  ('supply_type', 'Filament',  'filament',  10),
  ('supply_type', 'Cardboard', 'cardboard', 20),
  ('supply_type', 'Stickers',  'stickers',  30),
  ('supply_type', 'Tape',      'tape',      40),
  ('supply_type', 'Boxes',     'boxes',     50)
) as seed(kind, label, slug, sort_order)
where not exists (
  select 1 from public.vocabularies where kind = 'supply_type'
);
