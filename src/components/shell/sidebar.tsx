"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <aside className="hidden w-56 shrink-0 flex-col border-e border-line bg-surface md:flex">
      <div className="px-4 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink transition-opacity hover:opacity-80"
        >
          {t("app.name")}
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
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full text-2xs font-semibold text-white"
            style={{ backgroundColor: profile.color }}
          >
            {initials(profile.full_name)}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {profile.full_name || t("nav.account")}
          </span>
          <Settings aria-hidden className="size-3.5 shrink-0 text-faint" />
        </Link>

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
        className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-faint/70"
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
        <span className="rounded border border-line px-1 py-px text-[0.625rem] text-faint">
          soon
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
        className={cn("size-4 shrink-0", active && "text-brand")}
      />
      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
    </Link>
  );
}
