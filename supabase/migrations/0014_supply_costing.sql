-- 0014_supply_costing.sql — collapse "materials" into "supplies".
--
-- ⚠️ WHY THIS UNDOES 0007's "two tables stay two tables".
-- 0007 kept `materials` (what does a gram cost?) and `supplies` (how much is
-- left?) apart, joined by a nullable link. In practice that meant entering
-- filament TWICE: once in Settings to give it a price, once in Supplies to
-- track grams. A supply now carries its own cost-per-kg, so filament is added
-- ONCE, in the Supplies tab, and costing reads the price straight off it.
--
-- Boxes and gloves simply leave `cost_per_kg_minor` null — a supply with no
-- per-kg price is normal, and costing already treats an absent price as
-- "uncosted" (null, never ₺0). See src/lib/costing.ts.
--
-- Forward-only: the business data was wiped before this ran, so there is no
-- material→supply data to migrate. `products.material_id` is dropped outright.

-- ---------------------------------------------------------------------------
-- supplies gains the costing columns
-- ---------------------------------------------------------------------------
alter table public.supplies
  -- Integer kuruş per kilogram, like every other money column (see money.ts).
  -- Nullable on purpose: a supply that isn't a printing material (a box, a
  -- roll of tape) has no per-kg cost, and null reads as "uncosted".
  add column if not exists cost_per_kg_minor bigint
    check (cost_per_kg_minor is null or cost_per_kg_minor >= 0),
  -- Free-text kind kept as a labelled CHECK so the costing dropdown can group
  -- filament vs resin vs other, matching the old materials.kind.
  add column if not exists kind text not null default 'filament'
    check (kind in ('filament', 'resin', 'other'));

-- ---------------------------------------------------------------------------
-- products point at a supply, not a material
-- ---------------------------------------------------------------------------
-- set null: deleting the spool must not delete the product; it just becomes
-- uncosted for material (machine cost still computes). Same rule the old
-- products.material_id carried.
alter table public.products
  add column if not exists supply_id uuid
    references public.supplies (id) on delete set null;

-- print_runs already pointed at a supply (0007); products now do too, so the
-- run can read product.supply_id directly instead of hopping through material.

-- ---------------------------------------------------------------------------
-- retire the materials path
-- ---------------------------------------------------------------------------
-- print_runs.supply_id and products.supply_id are the live links now. The old
-- material link and the whole table go — nothing references them after this.
alter table public.products drop column if exists material_id;
drop table if exists public.materials cascade;
