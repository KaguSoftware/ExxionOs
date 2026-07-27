"use client";

import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CaptureBar } from "@/components/inspiration/capture-bar";
import { CaptureListeners } from "@/components/inspiration/capture-listeners";
import { PinMasonry } from "@/components/inspiration/pin-masonry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { archiveBoard, deleteBoard } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import type { Board, Idea, IdeaImage } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/**
 * One board.
 *
 * ⚠️ The capture surfaces are repeated here rather than living only on the
 * section root, because the board you have open IS the answer to "where should
 * this go" — dropping a picture here files it without a second step.
 *
 * ⚠️ ONE PRIMARY, EVERYTHING ELSE IN A MENU. The header used to carry four flat
 * controls — New pin, Edit, Archive and an unlabelled trash icon — giving a
 * rare destructive action the same weight as the common one. Archive in
 * particular has no visible effect on this page, so it is exactly the sort of
 * thing that should cost a deliberate second click.
 */
export function BoardDetail({
  board,
  pins,
  images,
  boards,
}: {
  board: Board;
  pins: Idea[];
  images: IdeaImage[];
  boards: Board[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run } = useAction();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleArchive = () =>
    run(() => archiveBoard(board.id, board.archived_at === null), {
      successMessage: t("inspiration.saved"),
      errorMessage: t("inspiration.saveFailed"),
      onSuccess: () => router.refresh(),
    });

  const remove = () =>
    run(() => deleteBoard(board.id), {
      successMessage: t("inspiration.deleted"),
      errorMessage: t("inspiration.deleteFailed"),
      onSuccess: () => {
        router.push("/inspiration?tab=boards");
        router.refresh();
      },
    });

  return (
    // The page wrapper every other detail surface in the app has. Without it
    // this page rendered flush to the viewport edge with no entry animation —
    // entering a board felt like leaving the app.
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      {/* The up-link, copied from machine-detail. Boards and pins were the only
          two detail pages in the app with no way back. */}
      <Link
        href="/inspiration?tab=boards"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("inspiration.boards")}
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {board.name}
            {board.archived_at && (
              <Badge tone="neutral">{t("inspiration.archivedBoard")}</Badge>
            )}
          </span>
        }
        description={board.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() =>
                router.push(`/inspiration/ideas/new?board=${board.id}`)
              }
              icon={<Plus aria-hidden className="size-4" />}
            >
              {t("inspiration.newPin")}
            </Button>
            <Menu
              label={t("common.more")}
              items={[
                {
                  id: "edit",
                  label: t("common.edit"),
                  icon: <Pencil aria-hidden className="size-3.5" />,
                  onSelect: () =>
                    router.push(`/inspiration/boards/${board.id}/edit`),
                },
                {
                  id: "archive",
                  label: board.archived_at
                    ? t("inspiration.unarchiveBoard")
                    : t("inspiration.archiveBoard"),
                  icon: board.archived_at ? (
                    <ArchiveRestore aria-hidden className="size-3.5" />
                  ) : (
                    <Archive aria-hidden className="size-3.5" />
                  ),
                  onSelect: () => void toggleArchive(),
                },
                {
                  id: "delete",
                  label: t("common.delete"),
                  icon: <Trash2 aria-hidden className="size-3.5" />,
                  destructive: true,
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
            />
          </div>
        }
      />

      <CaptureListeners boardId={board.id}>
        <div className="flex flex-col gap-4">
          <CaptureBar />
          <PinMasonry
            pins={pins}
            images={images}
            boards={boards}
            lockedBoardId={board.id}
          />
        </div>
      </CaptureListeners>

      <ConfirmDialog
        open={confirmDelete}
        title={t("inspiration.deleteBoard")}
        // ⚠️ Says the OPPOSITE of what Pinterest does — the pins survive. A
        // user who assumes otherwise would never press this button.
        body={t("inspiration.deleteBoardBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}
