"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  createTranslate,
  directionFor,
  type Locale,
  type Translate,
} from "./index";

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Translate;
  /**
   * Switch language WITHOUT a server round-trip. Both dictionaries are already
   * in the client bundle (see `createTranslate`), so the new language is one
   * re-render away — there is nothing to fetch.
   */
  setLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Mounted once in the root layout with the server-resolved locale, so client
 * components translate without a second source of truth and without a flash of
 * English before hydration.
 *
 * ⚠️ THE LOCALE IS STATE, SEEDED FROM THE PROP — NOT THE PROP ITSELF.
 *
 * Switching language used to mean a server action plus `router.refresh()`: a
 * full round-trip (~305ms on a good connection, and this app talks to
 * Stockholm) before a single word changed. Nothing was actually being fetched
 * — `createTranslate` resolves against dictionaries that are ALREADY in the
 * client bundle, both of them, on every page. The wait was pure ceremony.
 *
 * Holding it in state makes the switch instant: every consumer of `useI18n()`
 * re-renders with the new dictionary in the same frame. The server action
 * still runs, in the background, to persist the choice to `profiles.locale`
 * and the cookie so the NEXT cold load starts correct.
 *
 * The `seenLocale` block is the project's adopt-during-render pattern (never
 * `useEffect(() => setX(prop))`): if the server later hands down a different
 * locale — a hard navigation, or another device changing the profile — that
 * wins, without the effect first committing a stale value and bouncing the UI.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Locale>(locale);
  const [seenLocale, setSeenLocale] = useState<Locale>(locale);

  if (seenLocale !== locale) {
    setSeenLocale(locale);
    setActive(locale);
  }

  const setLocale = useCallback((next: Locale) => {
    setActive(next);
    // `<html lang>` is server-rendered, so it would otherwise still claim the
    // old language — which is what a screen reader and the browser's own
    // hyphenation/spellcheck actually read.
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = directionFor(next);
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale: active,
      dir: directionFor(active),
      t: createTranslate(active),
      setLocale,
    }),
    [active, setLocale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // A client component rendered outside the provider would otherwise render
    // silently in English forever. Fail loudly instead.
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}

/** Convenience: `const t = useT()`. */
export function useT(): Translate {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** The instant language switch. See `I18nProvider`. */
export function useSetLocale(): (next: Locale) => void {
  return useI18n().setLocale;
}

export { DEFAULT_LOCALE };
