"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  ImagePicker,
  type StagedImage,
} from "@/components/inspiration/image-picker";
import { MultiComboCreate } from "@/components/ui/combo-create";
import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import { useToast } from "@/components/ui/toast";
import { attachImage } from "@/lib/actions/creative";
import { createPin, updatePin } from "@/lib/actions/inspiration";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards } from "@/lib/inspiration";
import type { Board, Idea, Vocabulary } from "@/lib/types";
import { uploadImageToCreative } from "@/lib/upload";
import { useAction } from "@/lib/use-action";
import { vocabOptions } from "@/lib/vocab";

/**
 * Create OR edit a pin — the text side of capture.
 *
 * ⚠️ THERE IS NO PHOTO FIELD HERE, deliberately. Pictures arrive by drop, paste
 * or URL and each of those creates the pin FIRST, then attaches; adding a
 * staged uploader would mean uploading a file against an id that may never
 * exist. Photos are managed on the pin's own page, once it has one.
 *
 * ⚠️ Status is not edited here either — the pin page has a one-click control
 * for it, the same shape the ideas list always had.
 */
export function PinComposer({
  existing,
  boards,
  tagVocabulary,
  defaultBoardId,
  onDone,
}: {
  existing?: Idea;
  boards: Board[];
  tagVocabulary: Vocabulary[];
  /** Pre-selects the board you were looking at when you hit "New pin". */
  defaultBoardId?: string | null;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { run, pending } = useAction();
  const ids = useId();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [boardId, setBoardId] = useState(
    existing?.board_id ?? defaultBoardId ?? ""
  );
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [tagWords, setTagWords] = useState(tagVocabulary);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  /** Uploads run AFTER the action returns, so the button needs its own flag. */
  const [uploading, setUploading] = useState(false);

  const tagOptions = vocabOptions(tagWords, "idea_tag", existing?.tags ?? []).map(
    (v) => ({ value: v.label, label: v.label })
  );

  const boardOptions = [
    { value: "", label: t("inspiration.unsorted") },
    ...liveBoards(boards).map((b) => ({ value: b.id, label: b.name })),
  ];

  // A pin may legitimately be nothing but a picture, so an empty title is not
  // worth asking about once one is attached — unlike a collection, where a
  // blank name is unusable.
  const emptyFields =
    title.trim() || body.trim() || staged.length > 0
      ? []
      : [t("inspiration.pinTitle")];

  const submit = async () => {
    const input = {
      title,
      body: body || null,
      boardId: boardId || null,
      tags,
      links,
    };

    const result = await run(
      () => (existing ? updatePin(existing.id, input) : createPin(input)),
      {
        successMessage: t("inspiration.saved"),
        errorMessage: t("inspiration.saveFailed"),
      }
    );
    if (!result.ok) return;

    // ⚠️ UPLOADS HAPPEN HERE, NOT WHEN THE FILE WAS CHOSEN. The row now has a
    // real id, so nothing can end up in the bucket pointing at a pin that was
    // never created — a cancelled form uploads nothing at all.
    const pinId = result.data.id;
    if (staged.length > 0) {
      setUploading(true);
      try {
        for (const item of staged) {
          const upload = await uploadImageToCreative(item.file, "idea", pinId);
          if (!upload.ok) {
            toast.error(`${item.file.name}: ${t("inspiration.uploadFailed")}`);
            continue;
          }
          const attached = await attachImage({
            parent: "idea",
            parentId: pinId,
            path: upload.image.path,
            width: upload.image.width,
            height: upload.image.height,
          });
          // A sentinel message, never the raw server string — a Postgres error
          // in English is not something to show a Farsi user.
          if (!attached.ok) toast.error(t("inspiration.saveFailed"));
        }
      } finally {
        setUploading(false);
      }
    }

    if (onDone) onDone();
    // Land on the pin itself, not the wall — with pictures attached, the thing
    // you just made is what you want to look at.
    else router.push(`/inspiration/pins/${pinId}`);
    router.refresh();
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending || uploading}
      submitLabel={existing ? t("common.save") : undefined}
      // Only in overlay/edit mode; on the create page CreateForm's default
      // (router.back) is the right cancel.
      onCancel={onDone}
    >
      {/* Pictures lead — this is a board, and the page's own description
          promises you can add one here.

          ⚠️ THERE IS NO URL FIELD ON THIS FORM, and there must not be one. It
          had one, and it was a data-loss trap: it called `captureFromUrl`
          immediately, which mints a pin from the page's own metadata, then
          navigated to that new pin — silently discarding the title, notes,
          tags, links and staged pictures already typed here. Two pin-creators
          on one form cannot both be right, and the wall's capture bar is now
          mounted section-wide, so this one had no reason to exist.

          The better shape, if it is ever wanted: a `fetchOpenGraph` action that
          RETURNS metadata without inserting, so the button fills these fields
          instead of replacing them. That needs its own server action and its
          own SSRF path — a separate change. */}
      <ImagePicker value={staged} onChange={setStaged} />

      <Field id={`${ids}-title`} label={t("inspiration.pinTitle")}>
        <TextInput
          id={`${ids}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("inspiration.pinTitlePlaceholder")}
          maxLength={200}
        />
      </Field>

      <Field
        id={`${ids}-body`}
        label={t("inspiration.pinBody")}
        optional={t("common.optional")}
      >
        <TextArea
          id={`${ids}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("inspiration.pinBodyPlaceholder")}
          rows={4}
        />
      </Field>

      <Field id={`${ids}-board`} label={t("inspiration.board")}>
        <Dropdown
          id={`${ids}-board`}
          value={boardId}
          onChange={setBoardId}
          options={boardOptions}
          label={t("inspiration.board")}
          placeholder={t("inspiration.unsorted")}
        />
      </Field>

      <Field id={`${ids}-tags`} label={t("inspiration.tags")}>
        <MultiComboCreate
          id={`${ids}-tags`}
          values={tags}
          onChange={setTags}
          options={tagOptions}
          label={t("inspiration.tags")}
          placeholder={t("inspiration.addTag")}
          onCreate={async (label) => {
            const result = await createVocabulary({ kind: "idea_tag", label });
            if (!result.ok) return null;
            setTagWords((rows) => [
              ...rows.filter((r) => r.id !== result.data.id),
              result.data,
            ]);
            return result.data.label;
          }}
        />
      </Field>

      <LinksEditor value={links} onChange={setLinks} />
    </CreateForm>
  );
}
