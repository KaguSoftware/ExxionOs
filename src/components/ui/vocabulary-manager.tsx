"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import {
  archiveVocabulary,
  countVocabularyUsage,
  createVocabulary,
  deleteVocabulary,
  renameVocabulary,
} from "@/lib/actions/vocabulary";
import { useI18n } from "@/lib/i18n/client";
import type { Vocabulary, VocabularyKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

/**
 * "A place to edit, delete, and manage all these" — one panel, reused for
 * every vocabulary kind.
 *
 * Structurally this is `finance/categories-panel.tsx` generalised: same
 * inline-add row, same edit-in-place, same optimistic+rollback, same
 * adopt-server-truth-during-render. The one addition is DELETE, which
 * categories deliberately does not have.
 *
 * ⚠️ WHY DELETE IS ALLOWED HERE AND NOT FOR CATEGORIES. A category is
 * referenced by `transactions.category_id`, so deleting one silently rewrites
 * what past months were spent on. A vocabulary word is NOT a foreign key —
 * the label is copied onto the record. Deleting an unused word therefore
 * removes nothing but the word itself. Deleting an IN-USE word is still
 * refused by the server, because a word visibly on screen that can no longer
 * be picked reads as data loss.
 */
export function VocabularyManager({
  kind,
  items,
  title,
  addLabel,
  emptyTitle,
}: {
  kind: VocabularyKind;
  items: Vocabulary[];
  title: string;
  addLabel: string;
  emptyTitle: string;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [list, setList] = useState(items);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [confirming, setConfirming] = useState<Vocabulary | null>(null);

  // Adopt server truth DURING RENDER — never in an effect, which would commit
  // the stale list for a frame and make rows visibly bounce after a save.
  const [seen, setSeen] = useState(items);
  if (seen !== items) {
    setSeen(items);
    setList(items);
  }

  const sorted = [...list].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  );

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setNewLabel("");
    setAdding(false);
    await run(() => createVocabulary({ kind, label }), {
      onSuccess: (created) =>
        // The server may return an EXISTING row (same word, different
        // spelling, or one that was archived). Replace-or-append rather than
        // push, or the list would show it twice.
        setList((rows) => [...rows.filter((r) => r.id !== created.id), created]),
      errorMessage: t("vocab.saveFailed"),
    });
  };

  const rename = async (id: string) => {
    const label = editLabel.trim();
    setEditingId(null);
    if (!label) return;
    const previous = list;
    await run(() => renameVocabulary(id, label), {
      optimistic: () =>
        setList((rows) => rows.map((r) => (r.id === id ? { ...r, label } : r))),
      rollback: () => setList(previous),
      errorMessage: t("vocab.saveFailed"),
    });
  };

  const toggleArchive = async (item: Vocabulary) => {
    const archived = !item.archived_at;
    const previous = list;
    await run(() => archiveVocabulary(item.id, archived), {
      optimistic: () =>
        setList((rows) =>
          rows.map((r) =>
            r.id === item.id
              ? { ...r, archived_at: archived ? new Date().toISOString() : null }
              : r
          )
        ),
      rollback: () => setList(previous),
      errorMessage: t("vocab.saveFailed"),
    });
  };

  /**
   * Ask the server how many records use the word BEFORE offering to delete it,
   * so the confirm can say what will actually happen rather than asking blind.
   */
  const askDelete = async (item: Vocabulary) => {
    const usage = await run(() => countVocabularyUsage(item.id), {
      errorMessage: t("vocab.saveFailed"),
    });
    if (!usage.ok) return;

    if (usage.data > 0) {
      // Not a dialog — there is nothing to confirm. Archive is the action that
      // makes sense here, and the toast says so.
      await run(() => archiveVocabulary(item.id, true), {
        optimistic: () =>
          setList((rows) =>
            rows.map((r) =>
              r.id === item.id
                ? { ...r, archived_at: new Date().toISOString() }
                : r
            )
          ),
        successMessage: t("vocab.archivedInstead", { count: usage.data }),
        errorMessage: t("vocab.saveFailed"),
      });
      return;
    }

    setConfirming(item);
  };

  const confirmDelete = async () => {
    const item = confirming;
    setConfirming(null);
    if (!item) return;
    const previous = list;
    await run(() => deleteVocabulary(item.id), {
      optimistic: () => setList((rows) => rows.filter((r) => r.id !== item.id)),
      rollback: () => setList(previous),
      errorMessage: t("vocab.saveFailed"),
    });
  };

  return (
    <>
      <Panel
        title={title}
        action={
          <Button
            size="sm"
            onClick={() => {
              setAdding(true);
              setNewLabel("");
            }}
            icon={<Plus aria-hidden className="size-3.5" />}
          >
            {t("common.add")}
          </Button>
        }
        bodyClassName={sorted.length === 0 && !adding ? undefined : "p-0"}
      >
        {adding && (
          <div className="flex items-center gap-2 border-b border-line p-3">
            <TextInput
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder={addLabel}
              aria-label={addLabel}
              autoFocus
              className="flex-1"
            />
            <Button variant="primary" size="sm" onClick={add} loading={pending}>
              {t("common.add")}
            </Button>
            <Button size="sm" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {sorted.length === 0 && !adding ? (
          <EmptyState
            icon={<Tags aria-hidden className="size-4" />}
            title={emptyTitle}
          />
        ) : (
          <ul>
            {sorted.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
              >
                {editingId === item.id ? (
                  <>
                    <TextInput
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void rename(item.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1"
                      aria-label={addLabel}
                    />
                    <IconButton
                      onClick={() => rename(item.id)}
                      label={t("common.save")}
                    >
                      <Check aria-hidden className="size-3.5" />
                    </IconButton>
                    <IconButton
                      onClick={() => setEditingId(null)}
                      label={t("common.cancel")}
                    >
                      <X aria-hidden className="size-3.5" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        item.archived_at ? "text-faint" : "text-ink"
                      )}
                    >
                      {item.label}
                    </span>
                    {item.archived_at && <Badge>{t("finance.archived")}</Badge>}
                    <IconButton
                      onClick={() => {
                        setEditingId(item.id);
                        setEditLabel(item.label);
                      }}
                      label={t("common.edit")}
                    >
                      <Pencil aria-hidden className="size-3.5" />
                    </IconButton>
                    <IconButton
                      onClick={() => toggleArchive(item)}
                      label={
                        item.archived_at
                          ? t("finance.unarchive")
                          : t("finance.archive")
                      }
                    >
                      {item.archived_at ? (
                        <ArchiveRestore aria-hidden className="size-3.5" />
                      ) : (
                        <Archive aria-hidden className="size-3.5" />
                      )}
                    </IconButton>
                    {/* Falls back to archive when the word is in use — see
                        askDelete. The button never just fails. */}
                    <IconButton
                      onClick={() => askDelete(item)}
                      label={t("common.delete")}
                      danger
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirming !== null}
        title={t("vocab.deleteConfirm", { label: confirming?.label ?? "" })}
        body={t("vocab.deleteConfirmBody")}
        confirmLabel={t("common.delete")}
        loading={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function IconButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1.5 text-faint transition-colors hover:bg-raised",
        danger ? "hover:text-danger" : "hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
