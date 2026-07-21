import type { Category, Transaction } from "@/lib/types";
import { todayLocal } from "@/lib/utils";

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
    // Plain decimal with a dot: this file is read by spreadsheets and
    // accountants, so no currency symbol and no thousands separator — those
    // are exactly what make a CSV import as text instead of a number.
    (row.amount_minor / 100).toFixed(2),
    row.note ?? "",
    row.source_type ?? "",
  ]);

  return [header, ...body].map((cells) => cells.map(escapeCell).join(",")).join("\r\n");
}

/**
 * ⚠️ A leading =, +, - or @ makes Excel treat a cell as a FORMULA. A
 * description like "=2+2" would execute, and a malicious one could do worse.
 * Prefixing with a single quote neutralises it.
 */
function escapeCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(csv: string) {
  // A BOM, so Excel opens UTF-8 correctly — without it Turkish and Persian
  // characters arrive as mojibake.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // todayLocal() is correct here: the filename is about the person downloading,
  // not about when a transaction happened.
  link.download = `exxion-finance-${todayLocal()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
