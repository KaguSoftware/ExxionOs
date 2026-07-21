/**
 * Chart colour. VALIDATED, not chosen.
 *
 * Every value here was run through the dataviz validator against this project's
 * REAL chart surfaces (`#171417` dark, `#f9f8fa` light) — not the validator's
 * defaults, because contrast results are only meaningful against the surface
 * the chart actually renders on.
 *
 * ⚠️ If you change any of these, RE-RUN THE VALIDATOR for both modes. Do not
 * eyeball whether a palette is colourblind-safe; the whole point is that it is
 * computable.
 */

/**
 * Income vs expense — a DIVERGING pair (polarity), not two categorical slots.
 *
 * ⚠️ MEASURED, AND IT MATTERS: green↔red scores ΔE 6.5 under protanopia — the
 * 6–8 "floor band" — while blue↔red scores 19.2. Green/red is kept anyway
 * because it is the universal money convention and inverting it would confuse
 * far more people than it helps.
 *
 * The floor band is legal ONLY WITH SECONDARY ENCODING. That is why every
 * figure in this section carries an explicit +/− sign (`formatSignedMinor`) and
 * a text label, and why the two series are never distinguished by colour alone.
 * Those signs are an accessibility requirement, not decoration — do not remove
 * them to tidy the layout.
 */
export const MONEY_COLORS = {
  light: { in: "#1baf7a", out: "#e34948" },
  dark: { in: "#199e70", out: "#e66767" },
} as const;

/**
 * Categorical slots for the category breakdown, in FIXED ORDER.
 *
 * ⚠️ Assigned in sequence and NEVER CYCLED. A ninth category folds into
 * "Other" rather than reusing slot 1 — a repeated hue claims two things are the
 * same when they are not.
 *
 * ⚠️ Colour follows the CATEGORY (by its stable id), never the rank. If colour
 * tracked position, filtering out one category would repaint every survivor and
 * the reader would lose the thread between two views of the same data.
 *
 * Validated worst adjacent pair: ΔE 9.1 light / 8.4 dark (protan, ≥8 target);
 * normal-vision 19.6 light / 19.3 dark (≥15 floor).
 */
export const CATEGORY_COLORS = {
  light: [
    "#2a78d6", // blue
    "#eb6834", // orange
    "#1baf7a", // aqua
    "#eda100", // yellow
    "#e87ba4", // magenta
    "#008300", // green
    "#4a3aa7", // violet
    "#e34948", // red
  ],
  dark: [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767",
  ],
} as const;

/** Anything past slot 8 is folded into this, never given a generated hue. */
export const OTHER_COLOR = { light: "#8b8a86", dark: "#8b8a86" } as const;

export const MAX_CATEGORY_SLOTS = CATEGORY_COLORS.light.length;

export type ChartMode = "light" | "dark";
