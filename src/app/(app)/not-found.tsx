import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";

/**
 * Where the ten `notFound()` calls in this segment land — a deleted client, a
 * collection someone had bookmarked, a mistyped id.
 *
 * Without this file every one of them fell through to Next's own default page:
 * unstyled, English-only, and rendered OUTSIDE the app shell, so the sidebar
 * vanished and the only way back was the browser's Back button. The three
 * dictionary keys it uses (`notFound`, `notFoundBody`, `backToDashboard`) were
 * already written in both locales and had no consumer.
 *
 * A server component, unlike `error.tsx` — nothing here is interactive, so the
 * way out is a plain <Link> and no client bundle is shipped for it.
 */
export default async function AppNotFound() {
  const t = await getT();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-line bg-surface text-muted">
          <FileQuestion aria-hidden className="size-5" />
        </div>

        <h1 className="text-base font-semibold text-ink">{t("common.notFound")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("common.notFoundBody")}</p>

        {/* Styled as the `secondary` button variant rather than rendering a
            <Button>: this is a navigation, and a real <a> keeps middle-click,
            open-in-new-tab and the status-bar preview that a button throws
            away. Heights match SIZES.md so it lines up with real buttons. */}
        <Link
          href="/"
          className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm text-ink transition-colors hover:border-line-strong hover:bg-raised"
        >
          {t("common.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
