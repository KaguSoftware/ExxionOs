"use client";

import { Check } from "lucide-react";

import { PageHeader } from "@/components/ui/panel";
import { useT } from "@/lib/i18n/client";
import type { TranslateKey } from "@/lib/i18n";

/**
 * The dashboard title and the "all clear" strip, translated on the CLIENT.
 *
 * Both were rendered on the server, which froze them in the request's language
 * — and after the instant locale switch (see `I18nProvider`) that made them the
 * only two strings on the page that stayed in the old language, one of them the
 * largest text on screen. The greeting KEY still has to be chosen on the server
 * (it depends on the hour in Istanbul, which the client can't be trusted to
 * agree on), so the server passes the key and the name; the wording is resolved
 * here and re-resolves the instant the language changes.
 */
export function DashboardGreeting({
  greetingKey,
  name,
}: {
  greetingKey: TranslateKey;
  name: string;
}) {
  const t = useT();
  return <PageHeader title={t(greetingKey, { name })} />;
}

export function AllClear() {
  const t = useT();
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-muted">
      <Check aria-hidden className="size-4 shrink-0 text-success" />
      <span className="text-ink">{t("dashboard.allClear")}</span>
      <span className="hidden text-xs text-faint sm:inline">
        {t("dashboard.allClearHint")}
      </span>
    </p>
  );
}
