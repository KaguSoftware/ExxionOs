"use client";

import { Archive, ArchiveRestore, Check, Pencil, Plus, Tags, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import {
  archiveCategory,
  createCategory,
  updateCategory,
} from "@/lib/actions/finance";
import { useI18n } from "@/lib/i18n/client";
import type { Category, CategoryKind } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

export function CategoriesPanel({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [items, setItems] = useState(categories);
  const [adding, setAdding] = useState<CategoryKind | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
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
                    {/* ⚠️ ARCHIVE, NEVER DELETE — deleting would strip the
                        category off every historical transaction and silently
                        change what past months were spent on. */}
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
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
