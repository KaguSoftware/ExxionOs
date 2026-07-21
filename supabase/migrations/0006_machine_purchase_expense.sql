-- 0006_machine_purchase_expense.sql
--
-- Lets a machine's PURCHASE optionally become a Finance expense.
--
-- ⚠️ WHY THIS IS OPT-IN AND NOT AUTOMATIC.
-- Most machines are entered into the system LONG AFTER they were bought, and
-- that purchase was already logged in Finance at the time. Creating an expense
-- automatically would double-count it — and date it to today, distorting two
-- months at once. So the machine form carries a checkbox, off by default, and
-- the expense (when asked for) is dated to `purchased_on`, not to now.
--
-- Compare maintenance_logs, where the cost IS always an expense: a repair you
-- are logging is one you just paid for.

alter table public.machines
  add column if not exists purchase_transaction_id uuid
    -- Same set-null contract as maintenance_logs.transaction_id: deleting the
    -- Finance row must not delete the machine.
    references public.transactions (id) on delete set null;
