"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LocaleToggle } from "@/components/shell/locale-toggle";
import { Logomark } from "@/components/shell/wordmark";
import { signOut } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";
import { NAV_ITEMS } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

export function Sidebar({ profile }: { profile: Profile }) {
  const t = useT();
  const pathname = usePathname();

  return (
    // `hidden md:flex` — the mobile bar carries navigation below this width.
    // `border-e`, not `border-r`: in Farsi the sidebar sits on the right and
    // the border must follow it.
    //
    // ⚠️ STICKY + h-dvh, and both halves matter. Without a height the <aside>
    // stretches to match the page, so on a long page the account/sign-out
    // footer ends up thousands of pixels down and the whole rail scrolls away.
    // Pinned to the viewport, only the NAV LIST scrolls (below), so the logo
    // and the account footer are always reachable.
    <aside
      className={cn(
        "hidden w-56 shrink-0 flex-col border-e border-line bg-surface md:flex",
        "sticky top-0 h-dvh"
      )}
    >
      <div className="px-4 py-4">
        <Link
          href="/"
          aria-label={t("app.name")}
          className="inline-flex items-center gap-2 rounded-lg text-ink transition-opacity hover:opacity-80"
        >
          <Logomark className="size-6" />
          <span className="font-display text-base">{t("app.name")}</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-raised text-ink"
              : "text-muted hover:bg-raised hover:text-ink"
          )}
        >
          {/* One brand colour for everyone — the INITIALS distinguish people,
              not the fill. A per-user colour was a setting that existed only to
              be configured, and an arbitrary hue competes with the reserved
              state colours the rest of the UI depends on. */}
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-2xs font-semibold text-brand-ink"
          >
            {initials(profile.full_name)}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {profile.full_name || t("nav.account")}
          </span>
          <Settings aria-hidden className="size-3.5 shrink-0 text-faint" />
        </Link>

        <LocaleToggle locale={profile.locale} />

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <LogOut aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
            {t("nav.signOut")}
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: (typeof NAV_ITEMS)[number];
  pathname: string;
}) {
  const t = useT();
  const Icon = item.icon;
  const active =
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  if (!item.ready) {
    return (
      <span
        // Not a link and not focusable — but visible, so the shape of the
        // finished app is legible from day one.
        aria-disabled
        // `text-faint`, NOT `text-faint/70`. --faint IS the documented contrast
        // floor (5.6:1 dark / 5.1:1 light); the /70 dropped it to 3.19:1 and
        // 2.73:1. A roadmap item still has to be readable — the `soon` chip and
        // `cursor-default` already say it isn't available.
        className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-faint"
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
        <span className="rounded border border-line px-1 py-px text-[0.625rem] text-faint">
          {t("nav.soon")}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-[var(--dur-fast)]",
        active
          ? "bg-brand-soft font-medium text-ink"
          : "text-muted hover:bg-raised hover:text-ink"
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", active && "text-brand-text")}
      />
      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
    </Link>
  );
}
