-- 0021_product_measured_grams.sql — the MEASURED filament weight of a product.
--
-- `products.grams` (0004) is an ESTIMATE — a number typed when the product was
-- designed, before anything was ever printed. This adds `measured_grams`: the
-- REAL weight of one printed unit INCLUDING ITS SUPPORTS, weighed on a scale the
-- first time the product is actually printed.
--
-- ⚠️ MEASURED OVERRIDES ESTIMATE. Once `measured_grams` is set, it becomes the
-- single source of truth for filament everywhere — stock deduction on a print
-- run (actions/creative.ts) and material cost (lib/costing.ts) both prefer it
-- over `grams`. The estimate stays as a fallback for products never yet printed.
--
-- Supports are DELIBERATELY included: they are real plastic pulled off the same
-- spool. Costing the model without them under-counts every print, which is
-- exactly the drift this field exists to kill.
--
-- Captured, not computed: the print-run overlay asks for it the first time a
-- product is printed (while this is null) and writes it back to the product;
-- after that it's editable on the product form like any other field.

alter table public.products
  add column if not exists measured_grams numeric
    check (measured_grams is null or measured_grams > 0);

comment on column public.products.measured_grams is
  'Weighed grams per printed unit, supports included. Overrides `grams` for stock + costing once set. Null = never weighed, fall back to the `grams` estimate.';
