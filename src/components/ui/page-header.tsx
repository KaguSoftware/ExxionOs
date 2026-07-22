"use client";

import type { ReactNode } from "react";

import type { TranslateKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/**
 * A page's <h1> block. A CLIENT component, unlike the rest of `panel.tsx`,
 * precisely so the language switch reaches page titles.
 *
 * ⚠️ `titleKey`/`descriptionKey` are PREFERRED over the plain `ReactNode`
 * props on any page viewable while the language is switched. A server page
 * resolving `title={t("…")}` freezes it in the request language, and the
 * instant locale switch (see `I18nProvider`) would leave the page's own title
 * — its largest text — stale in the old language. With a key this component
 * re-translates live. The `ReactNode` props stay for titles that are genuine
 * dynamic data (a client's name, a machine's label), which no dictionary key
 * covers.
 */
export function PageHeader({
  title,
  titleKey,
  description,
  descriptionKey,
  action,
}: {
  title?: ReactNode;
  titleKey?: TranslateKey;
  description?: ReactNode;
  descriptionKey?: TranslateKey;
  action?: ReactNode;
}) {
  const t = useT();
  const heading = titleKey ? t(titleKey) : title;
  const sub = descriptionKey ? t(descriptionKey) : description;
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {/* Page titles carry the brand voice; panel titles stay in the working
            face — see `.font-display` in globals.css. */}
        <h1 className="font-display text-2xl text-ink">{heading}</h1>
        {sub && <p className="mt-1 max-w-[70ch] text-sm text-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
