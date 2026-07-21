"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { createIssue } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import type { Collection, Product, Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const SEVERITY_KEY: Record<Severity, string> = {
  low: "creative.low",
  medium: "creative.medium",
  high: "creative.high",
};

export function IssueForm({
  collections,
  products,
  defaultCollectionId,
}: {
  collections: Collection[];
  products: Product[];
  defaultCollectionId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();

  const titleId = useId();
  const bodyId = useId();
  const collectionFieldId = useId();
  const productId = useId();
  const severityId = useId();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(
    defaultCollectionId ?? null
  );
  const [productIdValue, setProductId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity>("medium");

  // Only products from the chosen collection — offering every product in the
  // shop would make the field useless once there are a few collections.
  const relevantProducts = collectionId
    ? products.filter((p) => p.collection_id === collectionId)
    : [];

  const emptyFields = title.trim() ? [] : [t("creative.issueTitle")];

  const submit = async () => {
    const result = await run(
      () =>
        createIssue({
          title,
          body: body || null,
          collectionId,
          productId: productIdValue,
          severity,
        }),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );

    if (result.ok) {
      router.push(
        collectionId
          ? `/creative/collections/${collectionId}?tab=issues`
          : "/creative?tab=learnings"
      );
      router.refresh();
    }
  };

  return (
    <CreateForm onSubmit={submit} emptyFields={emptyFields} pending={pending}>
      <Field id={titleId} label={t("creative.issueTitle")}>
        <TextInput
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("creative.issueTitlePlaceholder")}
          autoFocus
          maxLength={200}
        />
      </Field>

      <Field id={bodyId} label={t("creative.issueBody")} optional={t("common.optional")}>
        <TextArea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("creative.issueBodyPlaceholder")}
          rows={4}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Both scope fields are OPTIONAL: a general workshop problem still
            belongs in Learnings even though it names no collection. */}
        <Field
          id={collectionFieldId}
          label={t("creative.collections")}
          optional={t("common.optional")}
        >
          <Dropdown
            id={collectionFieldId}
            value={collectionId}
            onChange={(v) => {
              setCollectionId(v || null);
              // Changing collection invalidates the product choice.
              setProductId(null);
            }}
            options={collections.map((c) => ({ value: c.id, label: c.name }))}
            label={t("creative.collections")}
            placeholder={t("creative.generalIssue")}
          />
        </Field>

        <Field
          id={productId}
          label={t("creative.products")}
          optional={t("common.optional")}
        >
          <Dropdown
            id={productId}
            value={productIdValue}
            onChange={(v) => setProductId(v || null)}
            options={relevantProducts.map((p) => ({ value: p.id, label: p.name }))}
            label={t("creative.products")}
            placeholder={t("common.choose")}
            disabled={relevantProducts.length === 0}
          />
        </Field>
      </div>

      <Field id={severityId} label={t("creative.severity")}>
        <Dropdown
          id={severityId}
          value={severity}
          onChange={(v) => setSeverity(v as Severity)}
          options={SEVERITIES.map((value) => ({
            value,
            label: t(SEVERITY_KEY[value] as never),
          }))}
          label={t("creative.severity")}
          placeholder={t("creative.medium")}
        />
      </Field>
    </CreateForm>
  );
}
