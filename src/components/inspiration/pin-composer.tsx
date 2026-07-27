"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { UrlCapture } from "@/components/inspiration/url-capture";
import { MultiComboCreate } from "@/components/ui/combo-create";
import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import { createPin, updatePin } from "@/lib/actions/inspiration";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { useI18n } from "@/lib/i18n/client";
import { liveBoards } from "@/lib/inspiration";
import type { Board, Idea, Vocabulary } from "@/lib/types";
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

  const tagOptions = vocabOptions(tagWords, "idea_tag", existing?.tags ?? []).map(
    (v) => ({ value: v.label, label: v.label })
  );

  const boardOptions = [
    { value: "", label: t("inspiration.unsorted") },
    ...liveBoards(boards).map((b) => ({ value: b.id, label: b.name })),
  ];

  // A pin may legitimately be nothing but a picture, so an empty title is not
  // worth asking about — unlike a collection, where a blank name is unusable.
  const emptyFields = title.trim() || body.trim() ? [] : [t("inspiration.pinTitle")];

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

    if (result.ok) {
      if (onDone) onDone();
      else router.push("/inspiration");
      router.refresh();
    }
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={existing ? t("common.save") : undefined}
      // Only in overlay/edit mode; on the create page CreateForm's default
      // (router.back) is the right cancel.
      onCancel={onDone}
    >
      {/* Only on create: the fastest path in is a link, so it leads. Editing an
          existing pin has nothing to capture — its source is already set. */}
      {!existing && (
        <UrlCapture
          boardId={boardId || null}
          onDone={(ideaId) => {
            if (onDone) onDone();
            else router.push(`/inspiration/pins/${ideaId}`);
          }}
        />
      )}

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
