"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { createIdea, updateIdea } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import type { Idea } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/**
 * Create OR edit an idea. On the `/creative/ideas/new` page `existing` is
 * absent and it creates then navigates back; opened over the Ideas list with an
 * `existing` idea it edits in place and calls `onDone` to close the overlay.
 *
 * ⚠️ Status is NOT edited here — each idea row has its own one-click status
 * control — so this form owns only the title and body.
 */
export function IdeaForm({
  existing,
  onDone,
}: {
  existing?: Idea;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const titleId = useId();
  const bodyId = useId();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");

  const emptyFields = title.trim() ? [] : [t("creative.ideaTitle")];

  const submit = async () => {
    const result = await run(
      () =>
        existing
          ? updateIdea(existing.id, { title, body: body || null })
          : createIdea({ title, body: body || null }),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );
    if (result.ok) {
      if (onDone) onDone();
      else router.push("/creative?tab=ideas");
      router.refresh();
    }
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={existing ? t("common.save") : undefined}
      // Only pass onCancel in overlay/edit mode; on the create page CreateForm's
      // default (router.back) is the right cancel.
      onCancel={onDone}
    >
      <Field id={titleId} label={t("creative.ideaTitle")}>
        <TextInput
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("creative.ideaTitlePlaceholder")}
          autoFocus
          maxLength={200}
        />
      </Field>

      <Field id={bodyId} label={t("creative.ideaBody")} optional={t("common.optional")}>
        <TextArea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
        />
      </Field>
    </CreateForm>
  );
}
