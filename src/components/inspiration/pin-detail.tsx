"use client";

import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ImageIcon,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ImageStrip } from "@/components/creative/image-strip";
import { Lightbox } from "@/components/creative/lightbox";
import { PinComposer } from "@/components/inspiration/pin-composer";
import { PinStatusControl } from "@/components/inspiration/pin-status";
import { SignedImage } from "@/components/inspiration/signed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateOverlay } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { LinksList } from "@/components/ui/links-list";
import { Menu } from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import { PageHeader } from "@/components/ui/page-header";
import {
  deleteIdea,
  promoteIdea,
  setBoardCover,
  setPinBoard,
  updateIdeaStatus,
} from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards, sourceLabel } from "@/lib/inspiration";
import type { Board, Idea, IdeaImage, IdeaStatus, Vocabulary } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/utils";

/**
 * One pin, opened.
 *
 * This is where a pin becomes editable in full: photos (the ONLY place they are
 * managed, because the row already exists here), board, tags, links, status,
 * and the bridge into Creative.
 */
export function PinDetail({
  pin: initial,
  images,
  boards,
  tagVocabulary,
  collectionName,
}: {
  pin: Idea;
  images: IdeaImage[];
  boards: Board[];
  tagVocabulary: Vocabulary[];
  collectionName: string | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run } = useAction();

  const [pin, setPin] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<IdeaImage | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [strip, setStrip] = useState(images);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPin(initial);
  }
  const [seenImages, setSeenImages] = useState(images);
  if (seenImages !== images) {
    setSeenImages(images);
    setStrip(images);
  }

  const source = sourceLabel(pin.source_url);
  const hero = strip[0];

  const setStatus = (status: IdeaStatus) => {
    const previous = pin;
    void run(() => updateIdeaStatus(pin.id, status), {
      optimistic: () => setPin((p) => ({ ...p, status })),
      rollback: () => setPin(previous),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  const moveToBoard = (boardId: string) => {
    const previous = pin;
    const next = boardId || null;
    void run(() => setPinBoard(pin.id, next), {
      optimistic: () => setPin((p) => ({ ...p, board_id: next })),
      rollback: () => setPin(previous),
      errorMessage: t("inspiration.saveFailed"),
    });
  };

  const promote = async () => {
    setPromoting(true);
    try {
      await run(() => promoteIdea(pin.id), {
        successMessage: t("inspiration.promoted"),
        errorMessage: t("inspiration.saveFailed"),
        onSuccess: (data) => {
          const { collectionId } = data as { collectionId: string };
          router.push(`/creative/collections/${collectionId}`);
          router.refresh();
        },
      });
    } finally {
      setPromoting(false);
    }
  };

  const remove = () =>
    run(() => deleteIdea(pin.id), {
      successMessage: t("inspiration.deleted"),
      errorMessage: t("inspiration.saveFailed"),
      onSuccess: () => {
        router.push(
          pin.board_id ? `/inspiration/boards/${pin.board_id}` : "/inspiration"
        );
        router.refresh();
      },
    });

  const boardName = pin.board_id
    ? (boards.find((b) => b.id === pin.board_id)?.name ?? null)
    : null;

  return (
    // The page wrapper every other detail surface has — this page and the board
    // page were the only two rendering flush to the viewport edge.
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      {/* Up to where the pin actually lives, not to a generic root. */}
      <Link
        href={
          pin.board_id ? `/inspiration/boards/${pin.board_id}` : "/inspiration"
        }
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {boardName ?? t("inspiration.title")}
      </Link>

      <PageHeader
        title={pin.title || t("inspiration.untitledPin")}
        description={formatDate(pin.created_at, locale)}
        action={
          <div className="flex items-center gap-2">
            {/* ⚠️ Edit is UNCONDITIONAL, and "Make it" has moved down beside
                Status. The header used to hold a conditional primary that
                reflowed the whole row when a pin was promoted — and the
                loudest control on the page was the one action that leaves the
                section entirely. */}
            <Button variant="primary" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
            <Menu
              label={t("common.more")}
              items={[
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel>
            {hero ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setViewing(hero)}
                  aria-label={t("creative.viewPhoto")}
                  className="overflow-hidden rounded-lg bg-raised"
                  style={
                    hero.width && hero.height
                      ? { aspectRatio: hero.width / hero.height }
                      : undefined
                  }
                >
                  <SignedImage
                    path={hero.path}
                    size={1200}
                    alt={pin.title || t("inspiration.untitledPin")}
                    className="size-full object-contain"
                  />
                </button>
                {pin.board_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Star aria-hidden className="size-3.5" />}
                    onClick={() =>
                      void run(() => setBoardCover(pin.board_id!, hero.path), {
                        successMessage: t("inspiration.coverSet"),
                        errorMessage: t("inspiration.saveFailed"),
                      })
                    }
                  >
                    {t("inspiration.setAsCover")}
                  </Button>
                )}
              </div>
            ) : (
              // ⚠️ NOT the wall's hint. This page has no drop or paste
              // listener, so telling someone to drop a picture here was a
              // straightforward lie — the strip below is the way in.
              <div className="flex flex-col items-center gap-2 py-8 text-faint">
                <ImageIcon aria-hidden className="size-6" />
                <p className="text-xs">{t("inspiration.noPictures")}</p>
              </div>
            )}

            <div className="mt-4">
              <ImageStrip
                parent="idea"
                parentId={pin.id}
                images={strip}
                onChange={(next) => setStrip(next as IdeaImage[])}
              />
            </div>
          </Panel>

          {pin.body && (
            <Panel title={t("inspiration.pinBody")}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {pin.body}
              </p>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={t("inspiration.status")}>
            <PinStatusControl status={pin.status} onChange={setStatus} />

            {/* ⚠️ "Make it" LIVES HERE, not in the header. It is the one
                control that leaves the section, and beside Status it reads as
                what it is — "this became a project" — rather than as the
                loudest button on the page. */}
            {!pin.collection_id && pin.status !== "dropped" && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void promote()}
                loading={promoting}
                icon={<ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />}
              >
                {t("inspiration.makeIt")}
              </Button>
            )}

            {pin.collection_id && (
              <Link
                href={`/creative/collections/${pin.collection_id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
                {collectionName ?? t("inspiration.openCollection")}
              </Link>
            )}
          </Panel>

          <Panel title={t("inspiration.board")}>
            <Dropdown
              value={pin.board_id ?? ""}
              onChange={moveToBoard}
              label={t("inspiration.moveToBoard")}
              placeholder={t("inspiration.unsorted")}
              options={[
                { value: "", label: t("inspiration.unsorted") },
                ...liveBoards(boards).map((b) => ({
                  value: b.id,
                  label: b.name,
                })),
              ]}
            />
          </Panel>

          {pin.tags.length > 0 && (
            <Panel title={t("inspiration.tags")}>
              <div className="flex flex-wrap gap-1.5">
                {pin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-raised px-2 py-0.5 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {(pin.source_url || pin.links.length > 0) && (
            <Panel title={t("inspiration.source")}>
              <div className="flex flex-col gap-2">
                {/* ⚠️ Provenance, shown separately from `links` — on a
                    link-only pin this is the ONLY way back to the thing the
                    picture was supposed to be. */}
                {pin.source_url && (
                  <a
                    href={pin.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand-text hover:underline"
                  >
                    <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                    <span dir="ltr" className="truncate">
                      {source ?? t("inspiration.openSource")}
                    </span>
                  </a>
                )}
                <LinksList links={pin.links} />
              </div>
            </Panel>
          )}
        </div>
      </div>

      <CreateOverlay
        open={editing}
        title={t("inspiration.editPin")}
        onClose={() => setEditing(false)}
      >
        {/* `key` re-seeds the form when the underlying pin changes; without it
            a refresh mid-edit would keep the stale text. */}
        {editing && (
          <PinComposer
            key={pin.id}
            existing={pin}
            boards={boards}
            tagVocabulary={tagVocabulary}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        )}
      </CreateOverlay>

      <ConfirmDialog
        open={confirmDelete}
        title={t("inspiration.deletePin")}
        body={t("inspiration.deletePinBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        // Returns the promise, so the dialog spins until the delete settles.
        onConfirm={remove}
      />

      {viewing && (
        <Lightbox
          bucket="creative"
          path={viewing.path}
          alt={pin.title || t("inspiration.untitledPin")}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
