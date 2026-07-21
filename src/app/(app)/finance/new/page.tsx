import { TransactionForm } from "@/components/finance/transaction-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function NewTransactionPage() {
  await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  // Archived categories are excluded: a new transaction should never be filed
  // under something retired.
  const categories = await rowsOrThrow<Category>(
    "finance.new.categories",
    supabase
      .from("categories")
      .select("*")
      .is("archived_at", null)
      .order("sort_order")
  );

  return (
    <CreatePage title={t("finance.newTransaction")}>
      <TransactionForm categories={categories} />
    </CreatePage>
  );
}
