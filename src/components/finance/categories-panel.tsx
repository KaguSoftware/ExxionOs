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
import { useToast } from "@/components/ui/toast";
import {
  archiveCategory,
  countCategoryUsage,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/actions/finance";
import { useI18n } from "@/lib/i18n/client";
import type { Category, CategoryKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

export function CategoriesPanel({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const { run, pending } = useAction();

  const [items, setItems] = useState(categories);
  const [adding, setAdding] = useState<CategoryKind | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirming, setConfirming] = useState<Category | null>(null);

  // Adopt server truth DURING RENDER — never in an effect, which would commit
  // the stale list for a frame and make the row visibly bounce after a save.
  const [seen, setSeen] = useState(categories);
  if (seen !== categories) {
    setSeen(categories);
    setItems(categories);
  }

  const add = async (kind: CategoryKind) => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setAdding(null);
    await run(() => createCategory({ name, kind }), {
      onSuccess: (created) => setItems((list) => [...list, created]),
      errorMessage: t("finance.saveFailed"),
    });
  };

  const rename = async (id: string) => {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;
    const previous = items;
    await run(() => updateCategory(id, name), {
      optimistic: () =>
        setItems((list) => list.map((c) => (c.id === id ? { ...c, name } : c))),
      rollback: () => setItems(previous),
      errorMessage: t("finance.saveFailed"),
    });
  };

  const toggleArchive = async (category: Category) => {
    const archived = !category.archived_at;
    const previous = items;
    await run(() => archiveCategory(category.id, archived), {
      optimistic: () =>
        setItems((list) =>
          list.map((c) =>
            c.id === category.id
              ? { ...c, archived_at: archived ? new Date().toISOString() : null }
              : c
          )
        ),
      rollback: () => setItems(previous),
      errorMessage: t("finance.saveFailed"),
    });
  };

  /**
   * Ask the server how many records use the category BEFORE offering to
   * delete, so the confirm states what will happen instead of asking blind.
   *
   * ⚠️ The in-use path is NOT a dialog — there is nothing to confirm. Archive
   * is the only sensible action, so it just happens and the toast says why.
   * Offering a confirm for a choice the user does not have is theatre.
   */
  const askDelete = async (category: Category) => {
    const usage = await run(() => countCategoryUsage(category.id), {
      errorMessage: t("finance.saveFailed"),
    });
    if (!usage.ok) return;

    const { transactions, recurring } = usage.data;
    if (transactions + recurring > 0) {
      // Name only the tables that actually have rows — "and 0 recurring items"
      // is noise that makes the real number harder to read.
      const message =
        transactions > 0 && recurring > 0
          ? t("finance.categoryInUse", {
              transactions: String(transactions),
              recurring: String(recurring),
            })
          : transactions > 0
            ? t("finance.categoryInUseTransactions", {
                transactions: String(transactions),
              })
            : t("finance.categoryInUseRecurring", {
                recurring: String(recurring),
              });

      // Already archived — say so, but don't re-write the timestamp.
      if (category.archived_at) {
        toast.success(message);
        return;
      }

      await run(() => archiveCategory(category.id, true), {
        optimistic: () =>
          setItems((list) =>
            list.map((c) =>
              c.id === category.id
                ? { ...c, archived_at: new Date().toISOString() }
                : c
            )
          ),
        successMessage: message,
        errorMessage: t("finance.saveFailed"),
      });
      return;
    }

    setConfirming(category);
  };

  const confirmDelete = async () => {
    const category = confirming;
    setConfirming(null);
    if (!category) return;
    const previous = items;
    await run(() => deleteCategory(category.id), {
      optimistic: () =>
        setItems((list) => list.filter((c) => c.id !== category.id)),
      rollback: () => setItems(previous),
      errorMessage: t("finance.saveFailed"),
    });
  };

  const render = (kind: CategoryKind) => {
    const list = items
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    return (
      <Panel
        title={kind === "income" ? t("finance.incomeCategory") : t("finance.expenseCategory")}
        action={
          <Button
            size="sm"
            onClick={() => {
              setAdding(kind);
              setNewName("");
            }}
            icon={<Plus aria-hidden className="size-3.5" />}
          >
            {t("common.add")}
          </Button>
        }
        bodyClassName={list.length === 0 && adding !== kind ? undefined : "p-0"}
      >
        {adding === kind && (
          <div className="flex items-center gap-2 border-b border-line p-3">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add(kind);
                }
                if (e.key === "Escape") setAdding(null);
              }}
              placeholder={t("finance.categoryName")}
              aria-label={t("finance.categoryName")}
              autoFocus
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => add(kind)}
              loading={pending}
            >
              {t("common.add")}
            </Button>
            <Button size="sm" onClick={() => setAdding(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {list.length === 0 && adding !== kind ? (
          <EmptyState
            icon={<Tags aria-hidden className="size-4" />}
            title={t("finance.noCategories")}
          />
        ) : (
          <ul>
            {list.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-2 row-compact border-b border-line last:border-0"
              >
                {editingId === category.id ? (
                  <>
                    <TextInput
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void rename(category.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1"
                      aria-label={t("finance.categoryName")}
                    />
                    <IconButton
                      onClick={() => rename(category.id)}
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
                        category.archived_at ? "text-faint" : "text-ink"
                      )}
                    >
                      {category.name}
                    </span>
                    {category.archived_at && <Badge>{t("finance.archived")}</Badge>}
                    <IconButton
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                      }}
                      label={t("common.edit")}
                    >
                      <Pencil aria-hidden className="size-3.5" />
                    </IconButton>
                    <IconButton
                      onClick={() => toggleArchive(category)}
                      label={
                        category.archived_at
                          ? t("finance.unarchive")
                          : t("finance.archive")
                      }
                    >
                      {category.archived_at ? (
                        <ArchiveRestore aria-hidden className="size-3.5" />
                      ) : (
                        <Archive aria-hidden className="size-3.5" />
                      )}
                    </IconButton>
                    {/* ⚠️ DELETES ONLY WHEN NOTHING USES IT. Both FKs are
                        `on delete set null`, so the database would let a
                        delete succeed and quietly un-categorise history —
                        `askDelete` counts first and archives instead. The
                        button never just fails. */}
                    <IconButton
                      onClick={() => askDelete(category)}
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
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-faint">{t("finance.archivedHint")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {render("expense")}
        {render("income")}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={t("finance.deleteCategory", { name: confirming?.name ?? "" })}
        body={t("finance.deleteCategoryBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDelete}
      />
    </div>
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
