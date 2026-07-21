"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

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
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Mounted once in the root layout with the server-resolved locale, so client
 * components translate without a second source of truth and without a flash of
 * English before hydration.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, dir: directionFor(locale), t: createTranslate(locale) }),
    [locale]
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

export { DEFAULT_LOCALE };
