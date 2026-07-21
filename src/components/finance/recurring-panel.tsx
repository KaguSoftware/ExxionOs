"use client";

import { Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";

import { RecurringForm } from "@/components/finance/recurring-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { deleteRecurring, toggleRecurring } from "@/lib/actions/finance";
import { useI18n } from "@/lib/i18n/client";
import type { Category, RecurringItem } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, formatMinor } from "@/lib/utils";

export function RecurringPanel({
  items: initial,
  categories,
}: {
  items: RecurringItem[];
  categories: Category[];
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();

  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RecurringItem | null>(null);

  // Server truth adopted during render, not in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setItems(initial);
  }

  const toggle = async (item: RecurringItem) => {
    const previous = items;
    const active = !item.active;
    await run(() => toggleRecurring(item.id, active), {
      // Optimistic: pausing is instant and reversible, so waiting on the
      // server would just make the toggle feel broken.
      optimistic: () =>
        setItems((list) =>
          list.map((i) => (i.id === item.id ? { ...i, active } : i))
        ),
      rollback: () => setItems(previous),
      errorMessage: t("finance.saveFailed"),
    });
  };

  const remove = async (item: RecurringItem) => {
    const previous = items;
    setConfirmDelete(null);
    await run(() => deleteRecurring(item.id), {
      optimistic: () => setItems((list) => list.filter((i) => i.id !== item.id)),
      rollback: () => setItems(previous),
      successMessage: t("finance.deleted"),
      errorMessage: t("finance.saveFailed"),
    });
  };

  return (
    <>
      <Panel
        title={t("finance.recurringItems")}
        action={
          <Button
            size="sm"
            variant="primary"
            onClick={() => setCreating(true)}
            icon={<Plus aria-hidden className="size-3.5" />}
          >
            {t("finance.newRecurring")}
          </Button>
        }
        bodyClassName={items.length === 0 ? undefined : "p-0"}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<Repeat aria-hidden className="size-4" />}
            title={t("finance.noRecurring")}
            description={t("finance.noRecurringHint")}
          />
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="min-w-0 flex-1 text-start"
                >
                  <p
                    className={cn(
                      "truncate text-sm",
                      item.active ? "text-ink" : "text-faint"
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{t(`finance.${item.cadence}` as never)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {t("finance.startsOn")} {formatDate(item.starts_on, locale)}
                    </span>
                    {!item.active && <Badge>{t("finance.paused")}</Badge>}
                  </p>
                </button>

                {/* Sign present here too — never colour alone. */}
                <span
                  className={cn(
                    "tnum shrink-0 text-sm font-medium",
                    item.direction === "in" ? "text-success" : "text-danger"
                  )}
                >
                  {item.direction === "in" ? "+" : "−"}
                  {formatMinor(item.amount_minor)}
                </span>

                <button
                  type="button"
                  onClick={() => toggle(item)}
                  aria-label={item.active ? t("finance.pause") : t("finance.resume")}
                  title={item.active ? t("finance.pause") : t("finance.resume")}
                  className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                >
                  {item.active ? (
                    <Pause aria-hidden className="size-3.5" />
                  ) : (
                    <Play aria-hidden className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(item)}
                  aria-label={t("common.delete")}
                  className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {(creating || editing) && (
        <RecurringForm
          existing={editing ?? undefined}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("finance.deleteRecurringTitle")}
        // Says plainly that history survives — deleting the template must not
        // read as "this will erase the last six months of rent".
        body={t("finance.deleteRecurringBody")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </>
  );
}
