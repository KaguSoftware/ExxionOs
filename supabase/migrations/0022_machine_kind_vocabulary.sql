-- 0022_machine_kind_vocabulary.sql — a machine's "type" (`kind`) becomes a
-- SEARCHABLE, USER-GROWN word, exactly like products.kind (0011) and a supply's
-- item (0016).
--
-- Nothing about the machines table changes: `kind` is already free text stored
-- verbatim (0005), which is the label-not-FK pattern the vocabulary registry
-- uses. All this does is register a `machine_kind` vocabulary kind so the New
-- machine form can offer the type-to-create picker instead of a bare text box.

alter table public.vocabularies
  drop constraint if exists vocabularies_kind_check;

alter table public.vocabularies
  add constraint vocabularies_kind_check
    check (kind in ('product_type', 'client_tag', 'supply_type', 'supply_item', 'machine_kind'));

-- Seed a starting set of types, only if none exists yet — same guarded shape as
-- the supply_item seed in 0016.
insert into public.vocabularies (kind, label, slug, sort_order)
select * from (values
  ('machine_kind', '3D printer',      '3d printer',      10),
  ('machine_kind', 'Sander',          'sander',          20),
  ('machine_kind', 'Curing station',  'curing station',  30),
  ('machine_kind', 'Wash station',    'wash station',    40),
  ('machine_kind', 'Laser cutter',    'laser cutter',    50)
) as seed(kind, label, slug, sort_order)
where not exists (
  select 1 from public.vocabularies where kind = 'machine_kind'
);
