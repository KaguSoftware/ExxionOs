import { todayLocal } from "@/lib/utils";

/**
 * Generic CSV helpers, factored out of `finance-export.ts` so every section can
 * export the rows on screen without re-deriving the two things that are easy to
 * get wrong: formula-injection escaping, and a UTF-8 BOM.
 *
 * ⚠️ ALWAYS export the FILTERED/VISIBLE rows, not the whole table — the button
 * sits beside a filter bar, so exporting anything else is a lie about what was
 * asked for. That is the caller's responsibility; this module just serialises.
 */

/**
 * ⚠️ A leading =, +, - or @ makes Excel/Sheets treat a cell as a FORMULA — a
 * description of "=2+2" would execute, and a hostile one could do worse.
 * Prefixing with a single quote neutralises it. Then quote any cell containing
 * a comma, quote or newline.
 */
export function escapeCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Header row + body rows → a CSV string (CRLF line endings, Excel-friendly). */
export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows]
    .map((cells) => cells.map(escapeCell).join(","))
    .join("\r\n");
}

/** Integer kuruş → a plain decimal ("1250.50") — no symbol, no separators, so a
 *  spreadsheet imports it as a number, not text. */
export function minorToCsvAmount(minor: number | null | undefined): string {
  return minor == null ? "" : (minor / 100).toFixed(2);
}

/**
 * Trigger a download of `csv` as `exxion-<name>-<today>.csv`.
 *
 * ⚠️ Prepends a UTF-8 BOM so Excel opens Turkish/Persian text correctly —
 * without it those characters arrive as mojibake. `todayLocal()` is right for
 * the filename: it's about the person downloading, not a business record.
 */
export function downloadCsv(csv: string, name: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `exxion-${name}-${todayLocal()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
