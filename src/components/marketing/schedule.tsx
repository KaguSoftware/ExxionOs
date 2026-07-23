"use client";

import { CalendarDays, List, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { createEvent, deleteEvent } from "@/lib/actions/clients";
import { useI18n } from "@/lib/i18n/client";
import { MARKETING_EVENT_KIND_KEY, MARKETING_KINDS } from "@/lib/marketing";
import type { Event, EventKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/utils";

/**
 * The Marketing SCHEDULE — a second LENS over the `events` table, not a second
 * table.
 *
 * ⚠️ Exactly the relationship Learnings has to `issues`: a client's timeline
 * (`components/clients/event-timeline.tsx`) and this schedule render the SAME
 * rows, filtered by `kind`. Nothing is copied, so nothing can drift, and an
 * event can never be missing from one view because someone forgot to sync it.
 * It even reuses the same `createEvent` / `deleteEvent` actions — this
 * component only preselects the marketing kinds.
 */
export function MarketingSchedule({
  events,
  today,
}: {
  events: Event[];
  /** From the server — never a render-time clock read (`react-hooks/purity`). */
  today: string;
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  // Resolved here, where `t` still has its key types, rather than threading a
  // narrowed `t` into the subcomponent (which erases them to `never`).
  const kindLabel = (kind: string) =>
    t(MARKETING_EVENT_KIND_KEY[kind] as never);

  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<Event | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  const [kind, setKind] = useState<EventKind>("filming");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredOn, setOccurredOn] = useState<string | null>(today);

  // Upcoming ascending (the next thing first), past descending (most recent
  // first) — each half read in the direction people actually scan it.
  const { upcoming, past } = useMemo(() => {
    const up: Event[] = [];
    const back: Event[] = [];
    for (const e of events) (e.occurred_on >= today ? up : back).push(e);
    up.sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    back.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    return { upcoming: up, past: back };
  }, [events, today]);

  const submit = () => {
    void run(
      () =>
        createEvent({
          kind,
          title,
          body: body || null,
          occurredOn: occurredOn ?? today,
          clientId: null,
          orderId: null,
        }),
      {
        successMessage: t("marketing.eventAdded"),
        errorMessage: t("marketing.saveFailed"),
        onSuccess: () => {
          setComposing(false);
          setTitle("");
          setBody("");
          setKind("filming");
          setOccurredOn(today);
          router.refresh();
        },
      }
    );
  };

  const addButton = (
    <Button
      size="sm"
      variant="ghost"
      icon={<Plus aria-hidden className="size-3.5" />}
      onClick={() => setComposing(true)}
    >
      {t("marketing.newEvent")}
    </Button>
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* List ↔ Calendar. A segmented toggle: the same rows, two shapes —
            a scannable list, or a month grid for spotting clashes and gaps. */}
        <div
          role="group"
          aria-label={t("marketing.viewToggle")}
          className="inline-flex overflow-hidden rounded-lg border border-line"
        >
          <ViewButton
            active={view === "list"}
            onClick={() => setView("list")}
            icon={<List aria-hidden className="size-3.5" />}
            label={t("marketing.viewList")}
          />
          <ViewButton
            active={view === "calendar"}
            onClick={() => setView("calendar")}
            icon={<CalendarDays aria-hidden className="size-3.5" />}
            label={t("marketing.viewCalendar")}
          />
        </div>
        {addButton}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-4" />}
          title={t("marketing.noEvents")}
          description={t("marketing.noEventsHint")}
        />
      ) : view === "calendar" ? (
        <ScheduleCalendar
          events={events}
          today={today}
          locale={locale}
          kindLabel={kindLabel}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {upcoming.length > 0 && (
            <Section
              label={t("marketing.upcoming")}
              events={upcoming}
              locale={locale}
              onDelete={setDeleting}
              kindLabel={kindLabel}
              deleteLabel={t("marketing.deleteEvent")}
            />
          )}
          {past.length > 0 && (
            <Section
              label={t("marketing.past")}
              events={past}
              locale={locale}
              onDelete={setDeleting}
              kindLabel={kindLabel}
              deleteLabel={t("marketing.deleteEvent")}
            />
          )}
        </div>
      )}

      <CreateOverlay
        open={composing}
        title={t("marketing.newEvent")}
        onClose={() => setComposing(false)}
      >
        <CreateForm
          onSubmit={submit}
          emptyFields={title.trim() ? [] : [t("marketing.eventTitle")]}
          pending={pending}
          submitLabel={t("marketing.newEvent")}
          onCancel={() => setComposing(false)}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${ids}-kind`} label={t("marketing.eventKind")}>
              <Dropdown
                id={`${ids}-kind`}
                value={kind}
                onChange={(v) => setKind(v as EventKind)}
                options={MARKETING_KINDS.map((k) => ({
                  value: k,
                  label: t(MARKETING_EVENT_KIND_KEY[k] as never),
                }))}
                label={t("marketing.eventKind")}
                placeholder={t("marketing.kindFilming")}
              />
            </Field>

            <Field id={`${ids}-date`} label={t("marketing.eventDate")}>
              <DatePicker id={`${ids}-date`} value={occurredOn} onChange={setOccurredOn} />
            </Field>
          </div>

          <Field id={`${ids}-title`} label={t("marketing.eventTitle")}>
            <TextInput
              id={`${ids}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field id={`${ids}-body`} label={t("marketing.eventBody")}>
            <TextArea
              id={`${ids}-body`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </Field>
        </CreateForm>
      </CreateOverlay>

      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={t("marketing.deleteEvent")}
        body={t("marketing.deleteEventBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting
            ? run(() => deleteEvent(deleting.id), {
                successMessage: t("marketing.eventDeleted"),
                errorMessage: t("marketing.saveFailed"),
                onSuccess: () => router.refresh(),
              })
            : undefined
        }
      />
    </>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors " +
        (active ? "bg-raised text-ink" : "text-muted hover:text-ink")
      }
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * A month grid over the SAME `events` rows — a lens on the lens. Gregorian in
 * both locales (the project keeps the calendar Gregorian; only digits and month
 * names localise), week starting Monday. Purely a different arrangement of the
 * data already in memory — no new query, no new table.
 *
 * ⚠️ `today` comes from the server and is the ONLY "now" — month navigation is
 * relative to it, never to a render-time clock read (`react-hooks/purity`).
 */
function ScheduleCalendar({
  events,
  today,
  locale,
  kindLabel,
}: {
  events: Event[];
  today: string;
  locale: string;
  kindLabel: (kind: string) => string;
}) {
  const { t } = useI18n();
  // Which month is shown, as an offset in months from today's month.
  const [monthOffset, setMonthOffset] = useState(0);

  const [baseYear, baseMonth] = today.split("-").map(Number);
  // Normalise the offset into a concrete year/month (0-indexed month math).
  const anchor = baseMonth - 1 + monthOffset;
  const year = baseYear + Math.floor(anchor / 12);
  const month = ((anchor % 12) + 12) % 12; // 0-11

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const list = map.get(e.occurred_on);
      if (list) list.push(e);
      else map.set(e.occurred_on, [e]);
    }
    return map;
  }, [events]);

  const monthLabel = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));

  // Grid: pad to a Monday start. JS getUTCDay is 0=Sun; shift so Mon=0.
  const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${`${month + 1}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`
    );
  }

  const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o - 1)}
          className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
          aria-label={t("marketing.prevMonth")}
        >
          <span aria-hidden>‹</span>
        </button>
        <span className="text-sm font-medium text-ink">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o + 1)}
          className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
          aria-label={t("marketing.nextMonth")}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-2xs font-medium tracking-wide text-faint uppercase"
          >
            {t(`marketing.dow_${w}` as never)}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const dayNum = Number(date.slice(-2));
          const dayEvents = eventsByDay.get(date) ?? [];
          const isToday = date === today;
          return (
            <div
              key={date}
              className={
                "min-h-16 rounded-md border p-1 " +
                (isToday ? "border-brand bg-brand-soft" : "border-line")
              }
            >
              <div className="mb-0.5 text-2xs text-faint tnum">{dayNum}</div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    title={`${kindLabel(e.kind)} · ${e.title}`}
                    className="truncate rounded bg-raised px-1 py-0.5 text-2xs text-ink"
                  >
                    {e.title || kindLabel(e.kind)}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-2xs text-faint">
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  label,
  events,
  locale,
  onDelete,
  kindLabel,
  deleteLabel,
}: {
  label: string;
  events: Event[];
  locale: string;
  onDelete: (event: Event) => void;
  kindLabel: (kind: string) => string;
  deleteLabel: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </h3>
      <ul className="rounded-xl border border-line">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 row-compact border-b border-line last:border-0"
          >
            <Badge className="mt-0.5 shrink-0">{kindLabel(event.kind)}</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{event.title}</p>
              {event.body && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{event.body}</p>
              )}
              <p className="mt-0.5 text-2xs text-faint">
                {formatDate(event.occurred_on, locale as never)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(event)}
              aria-label={deleteLabel}
              className="shrink-0 rounded-md p-1 text-faint transition-colors hover:text-danger"
            >
              <Trash2 aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
