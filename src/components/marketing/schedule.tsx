"use client";

import { CalendarDays, Plus, Trash2 } from "lucide-react";
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
      <div className="mb-3 flex justify-end">{addButton}</div>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-4" />}
          title={t("marketing.noEvents")}
          description={t("marketing.noEventsHint")}
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
        onConfirm={() => {
          const event = deleting;
          setDeleting(null);
          if (!event) return;
          void run(() => deleteEvent(event.id), {
            successMessage: t("marketing.eventDeleted"),
            onSuccess: () => router.refresh(),
          });
        }}
      />
    </>
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
            className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-0"
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
