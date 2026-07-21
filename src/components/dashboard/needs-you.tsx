"use client";

import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BellRing,
  Boxes,
  Clock,
  Megaphone,
  Package,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The first thing on the dashboard: what needs your attention.
 *
 * ⚠️ RENDERS NOTHING WHEN EVERY COUNT IS ZERO. A permanent bar reading
 * "0 overdue · 0 due · 0 to review" is furniture — it occupies the most
 * valuable space on the page to say nothing. An absent strip IS the "all
 * clear" signal, and the dashboard renders its own calm state instead.
 *
 * ⚠️ SIGNALS ARE RANKED, NOT LISTED. They used to render as one flat wrap of
 * identical links, so "someone owes us money" looked exactly like "a client
 * has gone quiet" — the reader had to weigh eight items themselves, every
 * time. Each signal declares a `tone`, and the list sorts by it:
 *
 *   money   — cash at risk. Unpaid delivered orders, campaigns over budget.
 *   blocked — work that cannot proceed. A machine down, filament out.
 *   time    — slipping, not yet lost. Overdue promises, reminders due.
 *   soft    — worth knowing. Quiet regulars, open learnings.
 *
 * ⚠️ Only `money` and `blocked` get colour, and they reuse the RESERVED state
 * colours for their real meaning (danger = money at risk, warning = blocked).
 * The other two stay neutral. Colouring all four would make the strip a
 * rainbow in which nothing is urgent.
 *
 * ⚠️ Every deep-link from here must use the TARGET PAGE'S REAL FILTER PARAMS.
 * On KaguOs this strip linked to `?preset=mine`, a param no page read, so the
 * link silently landed on an unfiltered board — it looked like a filtered
 * deep-link and filtered nothing, for months.
 */

type Tone = "money" | "blocked" | "time" | "soft";

/** Sort weight. Lower comes first. */
const TONE_ORDER: Record<Tone, number> = {
  money: 0,
  blocked: 1,
  time: 2,
  soft: 3,
};

const TONE_STYLES: Record<Tone, string> = {
  money: "border-danger/35 bg-danger-soft",
  blocked: "border-warning/35 bg-warning-soft",
  time: "border-line bg-surface",
  soft: "border-line bg-surface",
};

const ICON_STYLES: Record<Tone, string> = {
  money: "text-danger",
  blocked: "text-warning",
  time: "text-muted",
  soft: "text-faint",
};

type Signal = {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  label: string;
  href: string;
};

export function NeedsYou({
  dueCount,
  openIssues = 0,
  machinesDown = 0,
  lowSupplies = 0,
  ordersOverdue = 0,
  ordersUnpaid = 0,
  clientsQuiet = 0,
  campaignsOverBudget = 0,
  productsOutOfStock = 0,
}: {
  dueCount: number;
  openIssues?: number;
  machinesDown?: number;
  lowSupplies?: number;
  /** Past their promised date and not yet delivered or cancelled. */
  ordersOverdue?: number;
  /** Delivered with money still owed — the one that costs real money. */
  ordersUnpaid?: number;
  /** Regulars (2+ orders) with nothing for 90 days. One-timers aren't listed. */
  clientsQuiet?: number;
  /** Live campaigns whose logged spend has passed their planned budget. */
  campaignsOverBudget?: number;
  /** Products with no finished units left on the shelf. */
  productsOutOfStock?: number;
}) {
  const t = useT();

  const signals: Signal[] = [];

  // --- money at risk -------------------------------------------------------
  if (ordersUnpaid > 0) {
    signals.push({
      key: "unpaid",
      tone: "money",
      icon: Banknote,
      label: t("dashboard.ordersUnpaid", { count: ordersUnpaid }),
      href: "/shipping?tab=list",
    });
  }
  if (campaignsOverBudget > 0) {
    signals.push({
      key: "overBudget",
      tone: "money",
      icon: Megaphone,
      label: t("marketing.overBudgetCount", { count: campaignsOverBudget }),
      href: "/marketing?tab=campaigns",
    });
  }

  // --- blocked work --------------------------------------------------------
  if (machinesDown > 0) {
    signals.push({
      key: "machines",
      tone: "blocked",
      icon: Wrench,
      label:
        machinesDown === 1
          ? t("equipment.brokenOne")
          : t("equipment.brokenCount", { count: machinesDown }),
      href: "/equipment?tab=machines",
    });
  }
  if (lowSupplies > 0) {
    signals.push({
      key: "supplies",
      tone: "blocked",
      icon: Boxes,
      label:
        lowSupplies === 1
          ? t("equipment.lowOne")
          : t("equipment.lowCount", { count: lowSupplies }),
      href: "/equipment?tab=supplies",
    });
  }
  // ⚠️ OUT, not merely low. A product with one left is a nudge; a product with
  // none is the thing that makes you tell a customer "no" — which is the same
  // class of blocked as a machine down, and belongs in the same band.
  // Low-but-not-out lives on the Stock tab, where it can be acted on without
  // competing with genuine blockers here.
  if (productsOutOfStock > 0) {
    signals.push({
      key: "stock",
      tone: "blocked",
      icon: Package,
      label: t("dashboard.productsOutOfStock", { count: productsOutOfStock }),
      // The Stock tab's real param — see creative/panels.tsx.
      href: "/creative?tab=stock",
    });
  }

  // --- slipping ------------------------------------------------------------
  if (ordersOverdue > 0) {
    signals.push({
      key: "overdue",
      tone: "time",
      icon: Clock,
      label: t("dashboard.ordersOverdue", { count: ordersOverdue }),
      href: "/shipping?tab=board",
    });
  }
  if (dueCount > 0) {
    signals.push({
      key: "reminders",
      tone: "time",
      icon: BellRing,
      label:
        dueCount === 1
          ? t("dashboard.reminderDue")
          : t("dashboard.remindersDue", { count: dueCount }),
      // The reminders panel is on THIS page — anchor rather than navigate.
      href: "#reminders",
    });
  }

  // --- worth knowing -------------------------------------------------------
  if (clientsQuiet > 0) {
    signals.push({
      key: "quiet",
      tone: "soft",
      icon: Users,
      label: t("dashboard.clientsQuiet", { count: clientsQuiet }),
      href: "/clients?tab=insights",
    });
  }
  if (openIssues > 0) {
    signals.push({
      key: "issues",
      tone: "soft",
      icon: AlertCircle,
      label:
        openIssues === 1
          ? t("creative.openIssue")
          : t("creative.openIssues", { count: openIssues }),
      href: "/creative?tab=learnings",
    });
  }

  // Nothing needs you: render nothing at all.
  if (signals.length === 0) return null;

  signals.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  return (
    <section aria-labelledby="needs-you" className="mb-5">
      <h2
        id="needs-you"
        className="mb-2 text-xs font-medium tracking-wide text-muted uppercase"
      >
        {t("dashboard.needsYou")}
      </h2>

      {/* auto-fit rather than fixed columns: one signal shouldn't stretch
          across the page, and eight shouldn't cram onto a single line. */}
      <ul className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
        {signals.map((signal) => {
          const Icon = signal.icon;
          return (
            <li key={signal.key}>
              <Link
                href={signal.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                  "transition-colors duration-[var(--dur-fast)] hover:border-line-strong",
                  TONE_STYLES[signal.tone]
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-4 shrink-0", ICON_STYLES[signal.tone])}
                />
                {/* The label carries the count and the noun. Icon and tint are
                    SECONDARY encoding — the sentence alone must be enough. */}
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {signal.label}
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-faint transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5 rtl:-scale-x-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
