"use client";

import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CaptureDropzone } from "@/components/inspiration/capture-dropzone";
import { PinMasonry } from "@/components/inspiration/pin-masonry";
import { UrlCapture } from "@/components/inspiration/url-capture";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { PageHeader } from "@/components/ui/page-header";
import { archiveBoard, deleteBoard } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import type { Board, Idea, IdeaImage } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/**
 * One board.
 *
 * The capture surfaces are repeated here rather than living only on the section
 * root, because the board you have open IS the answer to "where should this
 * go" — dropping a picture here files it without a second step.
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
      errorMessage: t("inspiration.saveFailed"),
      onSuccess: () => {
        router.push("/inspiration?tab=boards");
        router.refresh();
      },
    });

  return (
    <>
      <PageHeader
        title={board.name}
        description={board.description ?? undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() =>
                router.push(`/inspiration/ideas/new?board=${board.id}`)
              }
              icon={<Plus aria-hidden className="size-4" />}
            >
              {t("inspiration.newPin")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/inspiration/boards/${board.id}/edit`)}
            >
              {t("common.edit")}
            </Button>
            <Button
              variant="ghost"
              onClick={toggleArchive}
              icon={
                board.archived_at ? (
                  <ArchiveRestore aria-hidden className="size-4" />
                ) : (
                  <Archive aria-hidden className="size-4" />
                )
              }
            >
              {board.archived_at
                ? t("inspiration.unarchiveBoard")
                : t("inspiration.archiveBoard")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label={t("common.delete")}
              icon={<Trash2 aria-hidden className="size-4" />}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <Panel>
          <UrlCapture boardId={board.id} />
        </Panel>

        <CaptureDropzone boardId={board.id}>
          <PinMasonry
            pins={pins}
            images={images}
            boards={boards}
            lockedBoardId={board.id}
          />
        </CaptureDropzone>
      </div>

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
    </>
  );
}
