"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { BoardsPanel } from "@/components/inspiration/boards-panel";
import { CaptureBar } from "@/components/inspiration/capture-bar";
import { CaptureListeners } from "@/components/inspiration/capture-listeners";
import { PinMasonry } from "@/components/inspiration/pin-masonry";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { VocabularyManager } from "@/components/ui/vocabulary-manager";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards } from "@/lib/inspiration";
import type { Board, Idea, IdeaImage, Vocabulary } from "@/lib/types";

/**
 * Three tabs: the wall, the folders, and the tag vocabulary.
 *
 * ⚠️ THERE IS NO "LIST" TAB ANY MORE. It rendered the same rows as the wall
 * with the same header button, and it was the only one of the two that could
 * do anything — every control lived there while the section's headline surface
 * was read-only. The wall now has hover actions and a quick-look, so the list
 * had nothing left it could uniquely do.
 *
 * ⚠️ `CaptureListeners` WRAPS `TabbedPanels` rather than living inside a tab.
 * Only the active tab is mounted, so window-level Ctrl+V and drop used to die
 * on Boards and Tags while the copy promised them unconditionally.
 */
export function InspirationPanels({
  pins,
  images,
  boards,
  tagVocabulary = [],
}: {
  pins: Idea[];
  images: IdeaImage[];
  boards: Board[];
  tagVocabulary?: Vocabulary[];
}) {
  const { t } = useI18n();

  return (
    <CaptureListeners boardId={null}>
      <TabbedPanels
        title={t("inspiration.title")}
        description={t("inspiration.subtitle")}
        tabs={[
          {
            id: "pins",
            label: t("inspiration.pins"),
            // Counts LIVE pins — things still in play. Counting made and
            // dropped ones too would be a number that only grows and that
            // nobody can act on.
            count: pins.filter(
              (p) => p.status === "new" || p.status === "exploring"
            ).length,
            action: (
              <Link href="/inspiration/ideas/new">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus aria-hidden className="size-3.5" />}
                >
                  {t("inspiration.newPin")}
                </Button>
              </Link>
            ),
            content: (
              <div className="flex flex-col gap-4">
                <CaptureBar />
                <PinMasonry
                  pins={pins}
                  images={images}
                  boards={liveBoards(boards)}
                />
              </div>
            ),
          },
          {
            id: "boards",
            label: t("inspiration.boards"),
            count: boards.filter((b) => b.archived_at === null).length,
            action: (
              <Link href="/inspiration/boards/new">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus aria-hidden className="size-3.5" />}
                >
                  {t("inspiration.newBoard")}
                </Button>
              </Link>
            ),
            content: <BoardsPanel boards={boards} pins={pins} images={images} />,
          },
          {
            id: "tags",
            label: t("vocab.ideaTags"),
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-faint">{t("vocab.manageHint")}</p>
                <VocabularyManager
                  kind="idea_tag"
                  items={tagVocabulary}
                  title={t("vocab.ideaTags")}
                  addLabel={t("vocab.ideaTagName")}
                  emptyTitle={t("vocab.noIdeaTags")}
                />
              </div>
            ),
          },
        ]}
      />
    </CaptureListeners>
  );
}
