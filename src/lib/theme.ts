import type { Theme } from "@/lib/types";

export const THEME_COOKIE = "exxion-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Turn the stored preference into the `data-theme` attribute the CSS reads.
 *
 * ⚠️ `system` returns UNDEFINED on purpose — no attribute at all.
 *
 * The server cannot know the visitor's OS colour scheme; there is no header
 * for it. So rather than guessing (and painting the wrong theme for a frame),
 * "system" means "write no attribute and let CSS decide": globals.css makes
 * dark the `:root` default and light an explicit `[data-theme="light"]`
 * override, and `color-scheme` lets the browser follow the OS from there.
 *
 * The consequence to remember: an explicit choice is authoritative and
 * instant; "system" is resolved by the browser, not by us.
 */
export function resolveThemeAttr(value: unknown): "light" | "dark" | undefined {
  if (value === "light" || value === "dark") return value;
  return undefined;
}
