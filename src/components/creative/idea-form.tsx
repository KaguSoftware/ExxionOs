"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { createIdea } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";

export function IdeaForm() {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const titleId = useId();
  const bodyId = useId();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const emptyFields = title.trim() ? [] : [t("creative.ideaTitle")];

  const submit = async () => {
    const result = await run(() => createIdea({ title, body: body || null }), {
      successMessage: t("creative.saved"),
      errorMessage: t("creative.saveFailed"),
    });
    if (result.ok) {
      router.push("/creative?tab=ideas");
      router.refresh();
    }
  };

  return (
    <CreateForm onSubmit={submit} emptyFields={emptyFields} pending={pending}>
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
