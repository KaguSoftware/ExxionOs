"use client";

import { Languages } from "lucide-react";

import { updatePreferences } from "@/lib/actions/settings";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

/**
 * One-click language switch, in the shell rather than buried in Settings.
 *
 * ⚠️ INSTANT, AND DELIBERATELY NOT AWAITED. Both dictionaries ship in the
 * client bundle, so switching is a context update — the tree re-renders in the
 * new language in the same frame. The server action still fires, but only to
 * persist the choice; the UI never waits on it and the button never disables.
 * Do not reintroduce `router.refresh()` here: it re-fetched every query on the
 * page to change words that were already on the client.
 *
 * ⚠️ A TOGGLE, NOT A PICKER. With exactly two locales a picker would ask you
 * to choose from a list whose answer is always "the other one" — the click
 * that opens it carries no information.
 *
 * ⚠️ SHOWS THE TARGET, NOT THE CURRENT LANGUAGE. A button labelled with the
 * state you are already in reads as a status display, and the first instinct
 * is to click it to *keep* that state. Labelling it with what pressing it
 * gives you is the only reading that matches what happens.
 *
 * ⚠️ Farsi is rendered in its own script AND its own direction (`dir="rtl"`)
 * even while the UI is in English, so the word reads correctly either way —
 * the same treatment `settings/appearance-form.tsx` gives its chips.
 *
 * ⚠️ This changes the LANGUAGE, not the layout direction. `DIRECTIONS` maps
 * both locales to `ltr` (lib/i18n/index.ts), so nothing mirrors. That is a
 * known limitation, not an oversight: the codebase already uses logical
 * properties throughout, so flipping it later is a one-line change plus an
 * audit — but the audit is the work, and it is not this change.
 */
export function LocaleToggle({
  className,
  size = "sm",
}: {
  className?: string;
  /** `md` matches the taller touch rows in the mobile sheet. */
  size?: "sm" | "md";
}) {
  // ⚠️ READS THE LIVE LOCALE FROM CONTEXT, not a `profile.locale` prop. The
  // profile only updates on a server round-trip, so after an instant switch a
  // prop-fed toggle would still compute `next` from the OLD value — offering
  // to switch you to the language you just switched to.
  const { t, locale, setLocale } = useI18n();
  const { run } = useAction();

  const next: Locale = locale === "en" ? "fa" : "en";
  const nextLabel = next === "fa" ? "فارسی" : "English";

  const switchTo = () => {
    // Instant. Both dictionaries are already in the bundle, so the whole tree
    // re-renders in the new language in this frame — no fetch, no refresh, no
    // spinner. The old path awaited a server action and then `router.refresh()`
    // before a single word changed.
    setLocale(next);

    // Persistence only, in the background: writes profiles.locale + the cookie
    // so the NEXT cold load starts in the right language. Nothing on screen is
    // waiting on it, so the button is never disabled.
    void run(() => updatePreferences({ locale: next }), {
      errorMessage: t("settings.saveFailed"),
    });
  };

  return (
    <button
      type="button"
      onClick={switchTo}
      // The accessible name says what will happen; the visible label is just
      // the language name, which would otherwise be ambiguous out of context.
      aria-label={t("settings.switchTo", { language: nextLabel })}
      className={cn(
        "flex w-full items-center rounded-lg text-muted transition-colors",
        "hover:bg-raised hover:text-ink disabled:opacity-55",
        size === "md" ? "gap-3 px-3 py-3 text-base" : "gap-2.5 px-2.5 py-2 text-sm",
        className
      )}
    >
      <Languages
        aria-hidden
        className={cn("shrink-0", size === "md" ? "size-5" : "size-4")}
      />
      <span dir={next === "fa" ? "rtl" : "ltr"}>{nextLabel}</span>
    </button>
  );
}
