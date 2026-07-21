import { MonthSummary } from "@/components/dashboard/month-summary";
import { NeedsYou } from "@/components/dashboard/needs-you";
import { Reminders } from "@/components/dashboard/reminders";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { PageHeader } from "@/components/ui/panel";
import { rowsOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { totals } from "@/lib/finance-series";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Direction, Reminder, Transaction } from "@/lib/types";
import { todayInIstanbul } from "@/lib/utils";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  /**
   * ⚠️ ONE WAVE. Every query this page needs goes in this single
   * `Promise.all`. A round-trip costs ~305ms; a query ADDED to an existing
   * wave costs ~3ms. When phases 2-7 add their counts here, they go INSIDE
   * this array — never in an `await` above it. Do not count queries; count
   * waves.
   */
  const today = todayInIstanbul();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [reminders, monthRows] = await Promise.all([
    rowsOrThrow<Reminder>(
      "dashboard.reminders",
      supabase
        .from("reminders")
        .select("*")
        .eq("owner_id", ctx.userId)
        .is("done_at", null)
        // Dated reminders first (nulls last), soonest first — a note to self
        // with no date shouldn't outrank something actually due.
        .order("due_on", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50)
    ),
    // Phase 2: this month's money. Added INSIDE the existing wave — ~3ms, not
    // a second round-trip. Only the two columns the totals need.
    rowsOrThrow<{ direction: Direction; amount_minor: number }>(
      "dashboard.month",
      supabase
        .from("transactions")
        .select("direction, amount_minor")
        .gte("occurred_on", monthStart)
        .lte("occurred_on", today)
    ),
  ]);

  const dueCount = reminders.filter((r) => r.due_on && r.due_on <= today).length;
  const monthTotals = totals(monthRows as Transaction[]);

  const greeting = greetingKey();
  const firstName = ctx.profile.full_name.split(/\s+/)[0] || "";

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <LiveRefresh tables={["reminders", "transactions"]} />

      <PageHeader title={t(greeting, { name: firstName })} />

      {/* ⚠️ Renders NOTHING when every count is zero. A permanent strip reading
          all zeros is furniture, not an answer to "what needs my attention?" */}
      <NeedsYou dueCount={dueCount} />

      {/* This month's money, linking into Finance. ⚠️ The link uses the REAL
          filter params from `use-finance-filters.ts` — a made-up param would
          silently land on an unfiltered view. */}
      <MonthSummary totals={monthTotals} monthStart={monthStart} today={today} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Reminders
          initial={reminders}
          className="lg:order-2 lg:col-start-2 lg:row-start-1"
        />

        <section className="rounded-xl border border-dashed border-line p-8 text-center lg:order-1">
          <p className="text-sm text-muted">{t("dashboard.recentActivity")}</p>
          <p className="mt-1 text-xs text-faint">{t("dashboard.comingInPhase")}</p>
        </section>
      </div>
    </div>
  );
}

function greetingKey() {
  // Istanbul hour, not the server's — the server is UTC and would greet
  // "good morning" at 2am local.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return "dashboard.greetingMorning" as const;
  if (hour < 18) return "dashboard.greetingAfternoon" as const;
  return "dashboard.greetingEvening" as const;
}
