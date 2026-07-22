import { minorToCsvAmount, toCsv } from "@/lib/csv";
import type { Category, Transaction } from "@/lib/types";

export { downloadCsv } from "@/lib/csv";

/**
 * CSV of the transactions currently on screen.
 *
 * ⚠️ Exports the FILTERED rows, not the whole table — the button sits next to
 * a filter bar, so exporting something other than what is visible would be a
 * lie about what you asked for.
 */
export function transactionsToCsv(
  rows: Transaction[],
  categories: Category[]
): string {
  const header = [
    "Date",
    "Direction",
    "Description",
    "Category",
    "Amount (TRY)",
    "Note",
    "Source",
  ];

  const body = rows.map((row) => [
    row.occurred_on,
    row.direction === "in" ? "Income" : "Expense",
    row.description,
    categories.find((c) => c.id === row.category_id)?.name ?? "",
    // Plain decimal with a dot — read by spreadsheets and accountants.
    minorToCsvAmount(row.amount_minor),
    row.note ?? "",
    row.source_type ?? "",
  ]);

  return toCsv(header, body);
}
