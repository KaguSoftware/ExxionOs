import { cn } from "@/lib/utils";

/**
 * The EXXION mark.
 *
 * ⚠️ INLINE SVG, NOT AN IMAGE FILE. The mark has to invert between themes and
 * sit on a brand fill, a page background, and a login card — an <img> can do
 * none of that without shipping three files that then drift apart. Drawn with
 * `currentColor` so a parent's text colour drives it.
 *
 * ⚠️ THE GLYPHS ARE PATHS, NOT TEXT. The logo's face is a heavy geometric sans
 * that is NOT the UI family (Inter), and is not loaded. Setting the mark in
 * <text> would silently fall back to Inter and quietly ship a different logo.
 *
 * Geometry measured off the source artwork, expressed on a 100×100 grid:
 * the dash spans 15.8→43.0%, the I bar 44.8→53.4%, and the O is centred at
 * 70.6% with a 13.6% outer radius. Corner radius is 22.2% — an iOS-style
 * squircle, which is where the source clearly comes from.
 */

/** The three marks, drawn in `currentColor` on a transparent 100×100 field. */
function Glyphs() {
  return (
    <>
      {/* dash */}
      <rect x="15.8" y="44.8" width="27.2" height="8.6" rx="1.2" />
      {/* I */}
      <rect x="44.8" y="34.8" width="8.6" height="28.3" rx="1.2" />
      {/* O — drawn as a ring via even-odd so it stays hollow on any fill */}
      <path
        fillRule="evenodd"
        d="M70.6 35.5a13.6 13.6 0 1 1 0 27.2 13.6 13.6 0 0 1 0-27.2Zm0 7.1a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z"
      />
    </>
  );
}

/**
 * The app icon: white marks knocked out of a brand-blue squircle.
 *
 * Used where the mark must survive at small sizes — the sidebar rail, the
 * mobile bar, the favicon. `--brand` rather than the raw logo hex, so it
 * tracks the theme's tuned blue instead of drifting from the UI.
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="EXXION"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="100" height="100" rx="22.2" fill="var(--brand)" />
      <g fill="var(--brand-ink)">
        <Glyphs />
      </g>
    </svg>
  );
}

/**
 * The full lockup: EXXION —IO.
 *
 * For surfaces with room to breathe (the login screen). In the app shell the
 * icon is used instead — the wide lockup crowds a 224px rail and shrinks to
 * illegibility on mobile.
 *
 * Set in the display face (Space Grotesk Bold), which is the closest match to
 * the logo artwork's heavy geometric grotesque — flattened curves, angular
 * joins. The `—IO` group keeps the mark's own spacing rather than relying on
 * the em dash's default sidebearings.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="EXXION"
      className={cn(
        "font-display inline-flex select-none items-baseline gap-[0.34em] text-3xl leading-none",
        className
      )}
    >
      <span>EXXION</span>
      {/* aria-hidden on the decorative half: a screen reader announcing
          "EXXION em-dash I O" is noise. The accessible name is on the parent. */}
      <span aria-hidden className="inline-flex items-baseline gap-[0.06em]">
        <span>—</span>
        <span>IO</span>
      </span>
    </span>
  );
}
