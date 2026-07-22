import { IssueForm } from "@/components/creative/issue-form";
import { CreatePage } from "@/components/ui/create";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { Collection, Product } from "@/lib/types";

export default async function NewIssuePage({
  searchParams,
}: {
  // Next 16: searchParams is async.
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection } = await searchParams;
  await getSessionContext();
  const supabase = await createClient();

  const [collections, products] = await Promise.all([
    rowsOrThrow<Collection>(
      "issue.new.collections",
      supabase.from("collections").select("*").order("name")
    ),
    rowsOrThrow<Product>(
      "issue.new.products",
      supabase.from("products").select("*").order("name")
    ),
  ]);

  return (
    <CreatePage titleKey="creative.newIssue" descriptionKey="creative.noIssuesHint">
      <IssueForm
        collections={collections}
        products={products}
        defaultCollectionId={collection}
      />
    </CreatePage>
  );
}
