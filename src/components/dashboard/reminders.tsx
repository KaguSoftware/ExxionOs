"use client";

import { BellOff, Plus, Sparkles, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import {
  createReminder,
  deleteReminder,
  toggleReminder,
} from "@/lib/actions/reminders";
import { useI18n } from "@/lib/i18n/client";
import type { Reminder } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";

export function Reminders({
  initial,
  className,
}: {
  initial: Reminder[];
  className?: string;
}) {
  const { t, locale } = useI18n();
  const { run } = useAction();
  const inputId = useId();

  const [items, setItems] = useState(initial);
  const [body, setBody] = useState("");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // ⚠️ Server truth is adopted DURING RENDER, never in an effect. An
  // `useEffect(() => setItems(initial), [initial])` commits the STALE list
  // first and then re-renders, so a just-ticked reminder visibly bounces back
  // for a frame after every save. That flash was the "the app dies for a
  // second" bug on KaguOs. `react-hooks/set-state-in-effect` flags it.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setItems(initial);
  }

  const today = todayInIstanbul();

  const add = async () => {
    if (!body.trim()) return;
    setAdding(true);
    const text = body;
    const date = dueOn;
    setBody("");
    setDueOn(null);

    await run(() => createReminder({ body: text, dueOn: date }), {
      onSuccess: (created) => setItems((list) => [created, ...list]),
      // No success toast: the row appearing IS the feedback. A toast for
      // something already visible is noise.
      errorMessage: undefined,
    });
    setAdding(false);
  };

  const toggle = (reminder: Reminder) => {
    const previous = items;
    void run(() => toggleReminder(reminder.id, true), {
      optimistic: () => setItems((list) => list.filter((r) => r.id !== reminder.id)),
      rollback: () => setItems(previous),
    });
  };

  const remove = (reminder: Reminder) => {
    const previous = items;
    void run(() => deleteReminder(reminder.id), {
      optimistic: () => setItems((list) => list.filter((r) => r.id !== reminder.id)),
      rollback: () => setItems(previous),
    });
  };

  return (
    <Panel title={t("dashboard.reminders")} className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* ⚠️ `basis-48` + `flex-1`, NOT `min-w-0 flex-1`. With `min-w-0` the
            input is allowed to shrink to nothing, so in a narrow container it
            collapsed to a few characters wide instead of forcing the row to
            wrap. A basis gives it a floor to defend. */}
        <TextInput
          id={inputId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={t("dashboard.reminderPlaceholder")}
          aria-label={t("dashboard.addReminder")}
          className="flex-1 basis-48"
        />
        {/* ⚠️ FIXED WIDTH. The input beside it grows, so a control that widened
            when it gained a value would shove the input sideways as you pick a
            date. Keep the width fixed regardless of content. */}
        <DatePicker
          value={dueOn}
          onChange={setDueOn}
          placeholder={t("common.chooseDate")}
          className="w-36 shrink-0"
        />
        <Button
          variant="primary"
          onClick={add}
          loading={adding}
          icon={<Plus aria-hidden className="size-4" />}
          aria-label={t("dashboard.addReminder")}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<BellOff aria-hidden className="size-4" />}
          title={t("dashboard.noReminders")}
          description={t("dashboard.reminderPlaceholder")}
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((reminder) => {
            const overdue = !!reminder.due_on && reminder.due_on < today;
            const dueToday = reminder.due_on === today;
            return (
              <li
                key={reminder.id}
                className="group flex items-start gap-2.5 border-b border-line py-2 last:border-0"
              >
                <Checkbox
                  checked={false}
                  onChange={() => toggle(reminder)}
                  aria-label={reminder.body}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm leading-snug text-ink">
                    <span className="min-w-0">{reminder.body}</span>
                    {reminder.generated && (
                      <Badge
                        tone="neutral"
                        icon={<Sparkles aria-hidden className="size-3" />}
                        className="shrink-0"
                      >
                        {t("dashboard.reminderAuto")}
                      </Badge>
                    )}
                  </p>
                  {reminder.due_on && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        overdue
                          ? "text-danger"
                          : dueToday
                            ? "text-warning"
                            : "text-faint"
                      )}
                    >
                      {overdue
                        ? t("dashboard.overdue")
                        : dueToday
                          ? t("dashboard.dueToday")
                          : formatDate(reminder.due_on, locale)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(reminder)}
                  aria-label={t("common.delete")}
                  className={cn(
                    "rounded p-1 text-faint transition-[color,opacity] hover:text-danger",
                    // Visible on focus as well as hover — a control that only
                    // appears on hover is unreachable by keyboard and invisible
                    // on touch.
                    "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  )}
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
