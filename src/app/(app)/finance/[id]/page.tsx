import { notFound } from "next/navigation";

import { TransactionForm } from "@/components/finance/transaction-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Category, Transaction } from "@/lib/types";

export default async function EditTransactionPage({
  params,
}: {
  // Next 16: params is async.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSessionContext();
  const supabase = await createClient();

  // One wave. The category list is needed regardless of whether the row
  // exists, so there is nothing to gain by making these sequential.
  const [transactionResult, categories] = await Promise.all([
    selectOrThrow<Transaction>(
      "finance.transaction",
      supabase.from("transactions").select("*").eq("id", id).maybeSingle()
    ),
    // ⚠️ ALL categories here, not just active ones — an existing row may be
    // filed under an archived category, and the form keeps that visible so
    // opening an old transaction can't silently blank its category.
    rowsOrThrow<Category>(
      "finance.edit.categories",
      supabase.from("categories").select("*").order("sort_order")
    ),
  ]);

  const transaction = transactionResult.data;
  if (!transaction) notFound();

  return (
    <CreatePage titleKey="finance.editTransaction">
      <TransactionForm categories={categories} existing={transaction} />
    </CreatePage>
  );
}
