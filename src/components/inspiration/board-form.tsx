"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { createBoard, updateBoard } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import type { Board } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/** Create or edit a board. Its cover is set from a pin, not chosen here. */
export function BoardForm({ existing }: { existing?: Board }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();
  const ids = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");

  const emptyFields = name.trim() ? [] : [t("inspiration.boardName")];

  const submit = async () => {
    const input = { name, description: description || null };
    const result = await run(
      () => (existing ? updateBoard(existing.id, input) : createBoard(input)),
      {
        successMessage: t("inspiration.saved"),
        errorMessage: t("inspiration.saveFailed"),
      }
    );

    if (result.ok) {
      // Both branches land on the board itself: after editing, that's where you
      // came from; after creating, it's where you want to be — the next thing
      // you do with a new board is put pins in it.
      router.push(`/inspiration/boards/${result.data.id}`);
      router.refresh();
    }
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={existing ? t("common.save") : undefined}
    >
      <Field id={`${ids}-name`} label={t("inspiration.boardName")}>
        <TextInput
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("inspiration.boardNamePlaceholder")}
          autoFocus
          maxLength={120}
        />
      </Field>

      <Field
        id={`${ids}-description`}
        label={t("inspiration.boardDescription")}
        optional={t("common.optional")}
      >
        <TextArea
          id={`${ids}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </Field>
    </CreateForm>
  );
}
