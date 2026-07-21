"use client";

import { Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { updatePreferences } from "@/lib/actions/settings";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import type { Profile, Theme } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

export function AppearanceForm({ profile }: { profile: Profile }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();

  /**
   * Saves on pick, with no Save button — deliberately unlike the profile form
   * above. Language and theme are VISIBLE changes: you see the result the
   * instant it applies, so a confirm step would only add a click to something
   * that is already its own feedback. A name change shows nothing, which is
   * why that one has a button.
   */
  const setTheme = (theme: Theme) => {
    if (theme === profile.theme) return;
    void run(() => updatePreferences({ theme }), {
      onSuccess: () => router.refresh(),
      errorMessage: t("settings.saveFailed"),
    });
  };

  const setLocale = (locale: Locale) => {
    if (locale === profile.locale) return;
    void run(() => updatePreferences({ locale }), {
      onSuccess: () => router.refresh(),
      errorMessage: t("settings.saveFailed"),
    });
  };

  const themes: { value: Theme; label: string; icon: LucideIcon }[] = [
    { value: "light", label: t("settings.themeLight"), icon: Sun },
    { value: "dark", label: t("settings.themeDark"), icon: Moon },
    { value: "system", label: t("settings.themeSystem"), icon: Monitor },
  ];

  const locales: { value: Locale; label: string }[] = [
    { value: "en", label: t("settings.english") },
    { value: "fa", label: t("settings.farsi") },
  ];

  return (
    <Panel title={t("settings.appearance")}>
      <div className="flex flex-col gap-5">
        <fieldset disabled={pending}>
          <legend className="mb-2 text-xs font-medium text-muted">
            {t("settings.theme")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <OptionChip
                key={value}
                selected={profile.theme === value}
                onClick={() => setTheme(value)}
                label={label}
                icon={<Icon aria-hidden className="size-4" />}
              />
            ))}
          </div>
        </fieldset>

        <fieldset disabled={pending}>
          <legend className="mb-2 text-xs font-medium text-muted">
            {t("settings.language")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {locales.map(({ value, label }) => (
              <OptionChip
                key={value}
                selected={profile.locale === value}
                onClick={() => setLocale(value)}
                label={label}
                icon={<Languages aria-hidden className="size-4" />}
                // Farsi is RTL; render its own name in its own direction so
                // the chip reads correctly even while the UI is in English.
                dir={value === "fa" ? "rtl" : "ltr"}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Panel>
  );
}

function OptionChip({
  selected,
  onClick,
  label,
  icon,
  dir,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      dir={dir}
      className={cn(
        "press inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        "transition-[background-color,border-color,color] duration-[var(--dur-fast)]",
        selected
          ? "border-brand bg-brand-soft font-medium text-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      )}
    >
      {icon}
      {label}
      {/* Reserves its slot so selecting doesn't resize the chip. */}
      <Check
        aria-hidden
        className={cn("size-3.5 text-brand-text", !selected && "invisible")}
      />
    </button>
  );
}
