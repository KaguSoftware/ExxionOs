/**
 * Money is an integer number of KURUŞ everywhere except the very edges.
 *
 * ⚠️ THE RULE: convert at the boundary, ONCE. A decimal (1250.50) exists only
 * in an input field and in a formatted string; everything between — the
 * database, every sum, every chart datum — is `amount_minor` (125050).
 *
 * Why: floating point cannot represent 0.1 exactly, so 0.1 + 0.2 !== 0.3. In a
 * ledger those errors accumulate across a column, and a total that is wrong by
 * one kuruş makes every other number on the page suspect. Integers are exact by
 * construction, and JS integers are safe past 9 quadrillion — about 90 trillion
 * lira, comfortably beyond a 3D-printing shop.
 */

/** Decimal lira → integer kuruş. The ONLY place rounding happens. */
export function toMinor(amount: number): number {
  // Math.round, not truncation: 12.345 must become 1235 (a half-kuruş rounds
  // up), and truncation would quietly lose money on every entry.
  return Math.round(amount * 100);
}

/** Integer kuruş → decimal lira, for an input field. */
export function toMajor(minor: number): number {
  return minor / 100;
}

/**
 * The signed value of a transaction in kuruş.
 *
 * ⚠️ `amount_minor` is always a POSITIVE magnitude; `direction` carries the
 * sign. Never store a negative amount — a signed amount plus a direction column
 * is two sources of truth for one fact, and they drift the first time someone
 * edits a row. Sum through this helper instead.
 */
export function signedMinor(row: {
  direction: "in" | "out";
  amount_minor: number;
}): number {
  return row.direction === "in" ? row.amount_minor : -row.amount_minor;
}

/** Net of a set of transactions, in kuruş. Exact — no float anywhere. */
export function netMinor(
  rows: { direction: "in" | "out"; amount_minor: number }[]
): number {
  return rows.reduce((sum, row) => sum + signedMinor(row), 0);
}

export function sumMinor(
  rows: { amount_minor: number }[],
  where?: (row: { amount_minor: number }) => boolean
): number {
  return rows.reduce(
    (sum, row) => (where && !where(row) ? sum : sum + row.amount_minor),
    0
  );
}
