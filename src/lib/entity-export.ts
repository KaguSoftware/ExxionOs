import { minorToCsvAmount, toCsv } from "@/lib/csv";
import type { Client, Order, Supply } from "@/lib/types";

/**
 * CSV exporters for the record-keeping sections, so a directory or a stock list
 * can leave the app for an invoice or an accountant. All reuse `csv.ts`, so the
 * formula-escaping and BOM are solved in one place.
 *
 * ⚠️ Each takes the rows the CALLER has already filtered — export what is on
 * screen, never the whole table.
 */

export function clientsToCsv(rows: Client[]): string {
  const header = [
    "Name",
    "Kind",
    "Source",
    "Email",
    "Phone",
    "City",
    "Tags",
    "Archived",
  ];
  const body = rows.map((c) => [
    c.name,
    c.kind,
    c.source ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.city ?? "",
    c.tags.join("; "),
    c.archived_at ? "yes" : "",
  ]);
  return toCsv(header, body);
}

/** Orders — `total_minor` is the AGREED PRICE (labelled as such), NOT revenue. */
export function ordersToCsv(
  rows: Order[],
  clientName: (id: string | null) => string
): string {
  const header = [
    "Code",
    "Title",
    "Client",
    "Stage",
    "Agreed price (TRY)",
    "Promised",
    "Carrier",
    "Tracking",
  ];
  const body = rows.map((o) => [
    o.code ?? "",
    o.title,
    clientName(o.client_id),
    o.stage,
    minorToCsvAmount(o.total_minor),
    o.promised_on ?? "",
    o.carrier ?? "",
    o.tracking_number ?? "",
  ]);
  return toCsv(header, body);
}

export function suppliesToCsv(rows: Supply[]): string {
  const header = [
    "Name",
    "Category",
    "Item",
    "Quantity",
    "Unit",
    "Low threshold",
    "Cost/kg (TRY)",
    "Last price (TRY)",
  ];
  const body = rows.map((s) => [
    s.name,
    s.category ?? "",
    s.item ?? "",
    String(s.quantity),
    s.unit,
    s.low_threshold == null ? "" : String(s.low_threshold),
    minorToCsvAmount(s.cost_per_kg_minor),
    minorToCsvAmount(s.last_price_minor),
  ]);
  return toCsv(header, body);
}
