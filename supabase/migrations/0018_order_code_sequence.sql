-- 0018_order_code_sequence.sql — Auto-generated order codes (EX-###).
--
-- Order codes ("EX-014", to say out loud on the phone) were typed by hand. Two
-- people typing the next number by hand eventually collide or skip. A Postgres
-- SEQUENCE hands out the next integer atomically — two orders created in the
-- same instant get 14 and 15, never both 14 — and a helper formats it as
-- EX-###. The action pre-fills the form with `next_order_code()`, still
-- editable, so a bespoke code ("GIFT-01") is always possible.
--
-- ⚠️ The sequence is the SUGGESTION, not a constraint. `orders.code` stays plain
-- nullable text (0008) — nothing here makes it unique or required, because a
-- walk-in slip or an imported legacy order may carry any code or none.

create sequence if not exists public.order_code_seq as bigint start with 1;

-- Seed the sequence past any codes that already exist, so the first generated
-- code doesn't collide with a hand-typed "EX-003". Reads the max numeric suffix
-- of existing EX-### codes; setval to that, so nextval yields max+1.
do $$
declare
  max_num bigint;
begin
  select coalesce(max((regexp_replace(code, '\D', '', 'g'))::bigint), 0)
    into max_num
    from public.orders
   where code ~ '^EX-\d+$';

  if max_num > 0 then
    -- `is_called => true` so the next nextval() returns max_num + 1.
    perform setval('public.order_code_seq', max_num, true);
  end if;
end $$;

-- The next code to suggest. SECURITY DEFINER so it runs with the sequence
-- owner's rights; granted to authenticated. Pads to at least 3 digits
-- (EX-001 … EX-999 … EX-1000).
create or replace function public.next_order_code()
  returns text
  language sql
  security definer
  set search_path = public
as $$
  select 'EX-' || lpad(nextval('public.order_code_seq')::text, 3, '0');
$$;

grant execute on function public.next_order_code() to authenticated;
