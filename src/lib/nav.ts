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
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, ready: true },
  { href: "/creative", labelKey: "nav.creative", icon: Palette, ready: false },
  { href: "/shipping", labelKey: "nav.shipping", icon: Package, ready: false },
  { href: "/finance", labelKey: "nav.finance", icon: Wallet, ready: false },
  { href: "/equipment", labelKey: "nav.equipment", icon: Boxes, ready: false },
  { href: "/clients", labelKey: "nav.clients", icon: Users, ready: false },
  { href: "/marketing", labelKey: "nav.marketing", icon: Megaphone, ready: false },
];
