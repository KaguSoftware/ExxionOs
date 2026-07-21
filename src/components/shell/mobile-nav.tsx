"use client";

import { LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { LocaleToggle } from "@/components/shell/locale-toggle";
import { Logomark } from "@/components/shell/wordmark";
import { signOut } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";
import { NAV_ITEMS } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

/** Kept in sync with the `overlay-out` animation duration below. */
const EXIT_MS = 180;

/**
 * Mobile navigation. A full-screen sheet rather than a horizontally-scrolling
 * strip: on KaguOs a scrolling strip hid every section past the third unless
 * you happened to guess to swipe, and left nowhere for account or sign-out.
 */
export function MobileNav({ profile }: { profile: Profile }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // ONE close path, so the exit animation plays no matter how the menu is
  // dismissed — backdrop, X, Escape, or following a link. Separate handlers
  // are how one of those routes ends up snapping shut without the animation.
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Link
          href="/"
          aria-label={t("app.name")}
          className="inline-flex items-center gap-2 text-ink"
        >
          <Logomark className="size-6" />
          <span className="font-display text-base">{t("app.name")}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("nav.openMenu")}
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </header>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.openMenu")}
          className={cn(
            "fixed inset-0 flex flex-col bg-bg md:hidden",
            closing ? "animate-overlay-out" : "animate-fade-in"
          )}
          style={{ zIndex: "var(--z-overlay)" }}
        >
          <div className="flex items-center justify-between row-comfortable border-b border-line">
            <span className="inline-flex items-center gap-2 text-ink">
              <Logomark className="size-6" />
              <span className="font-display text-base">{t("app.name")}</span>
            </span>
            <button
              type="button"
              onClick={close}
              aria-label={t("nav.closeMenu")}
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                if (!item.ready) {
                  return (
                    <li key={item.href}>
                      <span className="flex items-center gap-3 rounded-lg px-3 py-3 text-base text-faint/70">
                        <Icon aria-hidden className="size-5 shrink-0" />
                        <span className="flex-1">{t(item.labelKey)}</span>
                        <span className="rounded border border-line px-1.5 py-px text-2xs">
                          soon
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors",
                        active
                          ? "bg-brand-soft font-medium text-ink"
                          : "text-muted active:bg-raised"
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn("size-5 shrink-0", active && "text-brand-text")}
                      />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-line p-3">
            <Link
              href="/settings"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-base text-muted active:bg-raised"
            >
              {/* Matches the sidebar chip — see the note there. */}
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-ink"
              >
                {initials(profile.full_name)}
              </span>
              <span className="flex-1 truncate">
                {profile.full_name || t("nav.account")}
              </span>
              <Settings aria-hidden className="size-4 text-faint" />
            </Link>

            {/* `md` size to match the taller touch rows around it. */}
            <LocaleToggle locale={profile.locale} size="md" />

            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base text-muted active:bg-raised"
              >
                <LogOut aria-hidden className="size-5 shrink-0 rtl:rotate-180" />
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
