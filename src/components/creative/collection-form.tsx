"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { LinksEditor } from "@/components/ui/links-editor";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import type { Collection, CollectionStatus } from "@/lib/types";
import { COLLECTION_STATUSES } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const STATUS_KEY: Record<CollectionStatus, string> = {
  planned: "creative.planned",
  in_progress: "creative.in_progress",
  done: "creative.done",
  archived: "creative.archivedStatus",
};

export function CollectionForm({ existing }: { existing?: Collection }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const nameId = useId();
  const descId = useId();
  const statusId = useId();
  const startId = useId();

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<CollectionStatus>(existing?.status ?? "planned");
  const [startedOn, setStartedOn] = useState<string | null>(
    existing?.started_on ?? null
  );
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const emptyFields = name.trim() ? [] : [t("creative.collectionName")];

  const submit = async () => {
    const input = {
      name,
      description: description || null,
      status,
      startedOn,
      links,
    };
    const result = await run<unknown>(
      () =>
        existing
          ? updateCollection(existing.id, input)
          : createCollection(input).then((r) =>
              r.ok ? { ok: true as const, data: r.data.id } : r
            ),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );

    if (result.ok) {
      router.push(
        existing
          ? `/creative/collections/${existing.id}`
          : `/creative/collections/${result.data as string}`
      );
      router.refresh();
    }
  };

  const remove = async () => {
    const result = await run(() => deleteCollection(existing!.id), {
      successMessage: t("creative.deleted"),
      errorMessage: t("creative.saveFailed"),
    });
    if (result.ok) {
      router.push("/creative");
      router.refresh();
    }
  };

  return (
    <>
      <CreateForm
        onSubmit={submit}
        emptyFields={emptyFields}
        pending={pending}
        submitLabel={existing ? t("common.save") : t("common.create")}
      >
        <Field id={nameId} label={t("creative.collectionName")}>
          <TextInput
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("creative.collectionNamePlaceholder")}
            autoFocus
            maxLength={120}
          />
        </Field>

        <Field
          id={descId}
          label={t("creative.description")}
          optional={t("common.optional")}
        >
          <TextArea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={statusId} label={t("creative.status")}>
            <Dropdown
              id={statusId}
              value={status}
              onChange={(v) => setStatus(v as CollectionStatus)}
              options={COLLECTION_STATUSES.map((value) => ({
                value,
                label: t(STATUS_KEY[value] as never),
              }))}
              label={t("creative.status")}
              placeholder={t("creative.planned")}
            />
          </Field>
          <Field
            id={startId}
            label={t("creative.startedOn")}
            optional={t("common.optional")}
          >
            <DatePicker id={startId} value={startedOn} onChange={setStartedOn} />
          </Field>
        </div>

        <LinksEditor value={links} onChange={setLinks} />
      </CreateForm>

      {existing && (
        <div className="mt-6 border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            icon={<Trash2 aria-hidden className="size-4" />}
            className="text-danger hover:text-danger"
          >
            {t("common.delete")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t("creative.deleteCollection")}
        // ⚠️ Says out loud that products go but issues stay. That asymmetry is
        // deliberate (knowledge outlives the project) and nobody would guess it.
        body={t("creative.deleteCollectionBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
