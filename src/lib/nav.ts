import {
  Boxes,
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { TranslateKey } from "@/lib/i18n";

export type NavItem = {
  href: string;
  labelKey: TranslateKey;
  icon: LucideIcon;
  /** Sections that arrive in a later phase render disabled, not hidden — an
   *  invisible roadmap looks like a missing feature. */
  ready: boolean;
};

/**
 * The six sections plus the dashboard, in the order they appear in the
 * sidebar. Order is deliberate: Dashboard, then the daily-work surfaces
 * (Creative, Shipping), then the records they feed (Finance, Equipment,
 * Clients, Marketing).
 *
 * ⚠️ `ready` FLIPS TO TRUE IN THE SAME COMMIT THAT SHIPS THE SECTION. An
 * unbuilt section renders visible-but-disabled with a "soon" chip, so the
 * shape of the finished app is legible from day one — but a built section
 * that is still marked `false` is invisible work, and a `true` one that isn't
 * built is a dead link. Update this line as part of the phase, not after it.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, ready: true },
  // Phase 3 — shipped.
  { href: "/creative", labelKey: "nav.creative", icon: Palette, ready: true },
  { href: "/shipping", labelKey: "nav.shipping", icon: Package, ready: false },
  // Phase 2 — shipped.
  { href: "/finance", labelKey: "nav.finance", icon: Wallet, ready: true },
  { href: "/equipment", labelKey: "nav.equipment", icon: Boxes, ready: false },
  { href: "/clients", labelKey: "nav.clients", icon: Users, ready: false },
  { href: "/marketing", labelKey: "nav.marketing", icon: Megaphone, ready: false },
];
