import { en, type Dictionary } from "./en";
import { fa } from "./fa";

export type Locale = "en" | "fa";

export const LOCALES: readonly Locale[] = ["en", "fa"] as const;
export const DEFAULT_LOCALE: Locale = "en";

// The cookie is a first-paint accelerator only — `profiles.locale` is the
// durable record. The layout writes the cookie from the profile so a signed-in
// user's choice follows them to a new device on first load.
export const LOCALE_COOKIE = "exxion-locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fa };

/**
 * ⚠️ FARSI RENDERS LEFT-TO-RIGHT, BY PARSA'S CHOICE (2026-07-21).
 *
 * Persian is an RTL script and this was `rtl` originally, but he asked for
 * translation only — no mirrored layout. So the UI keeps its direction and
 * Farsi keeps its words, Persian digits and date formats.
 *
 * ⚠️ THE LOGICAL CSS PROPERTIES AND THEIR LINT RULE STAY. `ps-`/`pe-`/`ms-`/
 * `me-` cost nothing while LTR (they resolve to left/right anyway), and
 * keeping them means turning RTL back on is EXACTLY this one line — not
 * another sweep through every component. Do not "simplify" them away.
 */
export const DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  fa: "ltr",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return DIRECTIONS[locale];
}

/**
 * Resolve a dotted key against the dictionary and fill {placeholders}.
 *
 * The key type is inferred from the English dictionary, so a typo is a compile
 * error rather than a string that renders as "dashboard.ttile".
 */
export type TranslateKey = DottedKeys<Dictionary>;

export type Translate = (
  key: TranslateKey,
  vars?: Record<string, string | number>
) => string;

export function createTranslate(locale: Locale): Translate {
  const dict = dictionaryFor(locale);
  return (key, vars) => {
    const value = resolve(dict, key);
    if (typeof value !== "string") {
      // Only reachable if the dictionaries drift at runtime, which `tsc`
      // prevents. Return the key so the surface is obviously wrong rather
      // than blank.
      return key;
    }
    return vars ? interpolate(value, vars) : value;
  };
}

function resolve(dict: Dictionary, key: string): unknown {
  let current: unknown = dict;
  for (const part of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

// --- key typing ------------------------------------------------------------
// Produces "nav.dashboard" | "common.save" | … from the dictionary shape.

type DottedKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${DottedKeys<T[K]>}`
      : never;
}[keyof T & string];

export type { Dictionary };
