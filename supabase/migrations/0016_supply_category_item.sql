-- 0016_supply_category_item.sql — split a supply's single `type` into a
-- CATEGORY (which Finance bucket it's bought under) and an ITEM (the specific
-- thing).
--
-- ⚠️ WHY TWO FIELDS INSTEAD OF ONE.
-- `type` (0015) tried to be both "what kind of thing" and "how it groups", and
-- it didn't connect to money: restocking anything booked the expense under a
-- hardcoded "Equipment" category. Now:
--   - `category` is a FINANCE EXPENSE CATEGORY NAME (Filament, Packaging,
--     Equipment…). A restock books its expense under THIS category, not a fixed
--     one. Stored as text (the category name), resolved to the id at write time
--     by categoryIdByName() — same label-not-FK pattern as products.kind, and
--     it creates the Finance category if it doesn't exist yet.
--   - `item` is the specific thing (Cardboard, Sticker, PLA Black…), backed by
--     a new `supply_item` vocabulary — the searchable/creatable picker.
--
-- The "is this a printing material?" signal is no longer a stored flag OR the
-- old toggle: a supply is a printing material when its CATEGORY is 'Filament'
-- or 'Resin' (the seeded Finance categories). See isPrintingCategory() in
-- src/lib/equipment.ts. cost_per_kg_minor (0014) still holds the per-kg price.

alter table public.supplies
  -- Finance expense category name. Nullable — an uncategorised supply is legal
  -- and books nothing special until restocked.
  add column if not exists category text,
  -- The specific item label, verbatim, backed by the supply_item vocabulary.
  add column if not exists item text;

-- `type` (0015) is superseded by category + item.
alter table public.supplies
  drop column if exists type;

-- Allow the new vocabulary kind for the Item picker.
alter table public.vocabularies
  drop constraint if exists vocabularies_kind_check;

alter table public.vocabularies
  add constraint vocabularies_kind_check
    check (kind in ('product_type', 'client_tag', 'supply_type', 'supply_item'));

-- Retire the supply_type seed from 0015 — it's replaced by category+item, and
-- leaving it would clutter a picker that no longer exists. Safe: nothing stores
-- a `type` anymore (column dropped above).
delete from public.vocabularies where kind = 'supply_type';

-- Seed a starting set of ITEMS, only if none exists yet.
insert into public.vocabularies (kind, label, slug, sort_order)
select * from (values
  ('supply_item', 'PLA Black',  'pla black',  10),
  ('supply_item', 'PLA White',  'pla white',  20),
  ('supply_item', 'Cardboard',  'cardboard',  30),
  ('supply_item', 'Stickers',   'stickers',   40),
  ('supply_item', 'Bubble wrap','bubble wrap',50),
  ('supply_item', 'Tape',       'tape',       60)
) as seed(kind, label, slug, sort_order)
where not exists (
  select 1 from public.vocabularies where kind = 'supply_item'
);
