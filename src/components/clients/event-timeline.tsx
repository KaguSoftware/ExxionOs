"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { createEvent, deleteEvent } from "@/lib/actions/clients";
import { EVENT_KIND_KEY } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import { CLIENT_EVENT_KINDS } from "@/lib/types";
import type { Event, EventKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/utils";

/**
 * A client's timeline. One `events` table, kind-tagged — Phase 7's Marketing
 * schedule is a second LENS over the same rows, never a second table. See
 * `learnings-panel.tsx` for the pattern this follows.
 */
export function EventTimeline({
  clientId,
  events,
  today,
}: {
  clientId: string;
  events: Event[];
  /** From the server — `todayInIstanbul()`, never a render-time clock read. */
  today: string;
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<Event | null>(null);

  const [kind, setKind] = useState<EventKind>("call");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredOn, setOccurredOn] = useState<string | null>(today);

  const reset = () => {
    setKind("call");
    setTitle("");
    setBody("");
    setOccurredOn(today);
  };

  const submit = () => {
    void run(
      () =>
        createEvent({
          kind,
          title,
          body: body || null,
          occurredOn: occurredOn ?? today,
          clientId,
          orderId: null,
        }),
      {
        successMessage: t("clients.eventAdded"),
        errorMessage: t("clients.saveFailed"),
        onSuccess: () => {
          setComposing(false);
          reset();
          router.refresh();
        },
      }
    );
  };

  return (
    <>
      <Panel
        title={t("clients.timeline")}
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus aria-hidden className="size-3.5" />}
            onClick={() => setComposing(true)}
          >
            {t("clients.newEvent")}
          </Button>
        }
      >
        {events.length === 0 ? (
          <EmptyState title={t("clients.noEvents")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                {/* Category = icon + word in the NEUTRAL tone. success/warning/
                    danger are the state vocabulary and are not spent here. */}
                <Badge className="mt-0.5 shrink-0">
                  {t(EVENT_KIND_KEY[event.kind] as never)}
                </Badge>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {event.title || t(EVENT_KIND_KEY[event.kind] as never)}
                  </p>
                  {event.body && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {event.body}
                    </p>
                  )}
                  <p className="mt-0.5 text-2xs text-faint">
                    {formatDate(event.occurred_on, locale)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleting(event)}
                  aria-label={t("clients.deleteEvent")}
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ⚠️ A full surface, not a modal — authoring in a modal is a cramped
          page. Modals are for destructive confirms only. */}
      <CreateOverlay
        open={composing}
        title={t("clients.newEvent")}
        onClose={() => setComposing(false)}
      >
        <CreateForm
          onSubmit={submit}
          emptyFields={title.trim() ? [] : [t("clients.eventTitle")]}
          pending={pending}
          submitLabel={t("clients.newEvent")}
          onCancel={() => setComposing(false)}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${ids}-kind`} label={t("clients.eventKind")}>
              <Dropdown
                id={`${ids}-kind`}
                value={kind}
                onChange={(v) => setKind(v as EventKind)}
                options={CLIENT_EVENT_KINDS.map((k) => ({
                  value: k,
                  label: t(EVENT_KIND_KEY[k] as never),
                }))}
                label={t("clients.eventKind")}
                placeholder={t("clients.kindCall")}
              />
            </Field>

            <Field id={`${ids}-date`} label={t("clients.eventDate")}>
              <DatePicker
                id={`${ids}-date`}
                value={occurredOn}
                onChange={setOccurredOn}
              />
            </Field>
          </div>

          <Field id={`${ids}-title`} label={t("clients.eventTitle")}>
            <TextInput
              id={`${ids}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field id={`${ids}-body`} label={t("clients.eventBody")}>
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
        loading={pending}
        title={t("clients.deleteEvent")}
        body={t("clients.deleteEventConfirm")}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const event = deleting;
          if (!event) return;
          void run(() => deleteEvent(event.id, clientId), {
            successMessage: t("clients.eventDeleted"),
            // Close on success so the spinner shows; the ref guard stops a
            // double-fire while the dialog is still open.
            onSuccess: () => {
              setDeleting(null);
              router.refresh();
            },
          });
        }}
      />
    </>
  );
}
