"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { BoardsPanel } from "@/components/inspiration/boards-panel";
import { CaptureDropzone } from "@/components/inspiration/capture-dropzone";
import { PinMasonry } from "@/components/inspiration/pin-masonry";
import { PinsList } from "@/components/inspiration/pins-list";
import { UrlCapture } from "@/components/inspiration/url-capture";
import { TabbedPanels } from "@/components/shell/tabbed-panels";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { VocabularyManager } from "@/components/ui/vocabulary-manager";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards } from "@/lib/inspiration";
import type { Board, Idea, IdeaImage, Vocabulary } from "@/lib/types";

/**
 * Four lenses on one section.
 *
 * ⚠️ Pins and List are the SAME ROWS, laid out two ways — a masonry for
 * browsing pictures, a flat column for scanning thoughts. Boards are the
 * folders, Tags the vocabulary behind the chips. Nothing here is a second copy
 * of anything else.
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

  const newPinAction = (
    <Link href="/inspiration/ideas/new">
      <Button
        size="sm"
        variant="primary"
        icon={<Plus aria-hidden className="size-3.5" />}
      >
        {t("inspiration.newPin")}
      </Button>
    </Link>
  );

  return (
    <TabbedPanels
      title={t("inspiration.title")}
      description={t("inspiration.subtitle")}
      tabs={[
        {
          id: "pins",
          label: t("inspiration.pins"),
          // The badge counts LIVE pins — things still in play. Counting made
          // and dropped ones too would be a number that only ever grows and
          // that nobody can act on.
          count: pins.filter(
            (p) => p.status === "new" || p.status === "exploring"
          ).length,
          action: newPinAction,
          content: (
            <div className="flex flex-col gap-4">
              <Panel>
                <UrlCapture boardId={null} />
              </Panel>
              <CaptureDropzone boardId={null}>
                <PinMasonry
                  pins={pins}
                  images={images}
                  boards={liveBoards(boards)}
                />
              </CaptureDropzone>
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
          content: (
            <BoardsPanel boards={boards} pins={pins} images={images} />
          ),
        },
        {
          id: "list",
          label: t("inspiration.list"),
          action: newPinAction,
          content: <PinsList pins={pins} boards={boards} />,
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
  );
}
