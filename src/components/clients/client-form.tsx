"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { MultiComboCreate } from "@/components/ui/combo-create";
import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import {
  createClientRecord,
  updateClientRecord,
} from "@/lib/actions/clients";
import { createVocabulary } from "@/lib/actions/vocabulary";
import { CLIENT_KIND_KEY, CLIENT_SOURCE_KEY } from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import { CLIENT_KINDS, CLIENT_SOURCES } from "@/lib/types";
import type { Client, ClientKind, ClientSource, Vocabulary } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { vocabOptions } from "@/lib/vocab";

export function ClientForm({
  client,
  tagVocabulary = [],
}: {
  client?: Client;
  tagVocabulary?: Vocabulary[];
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  // ⚠️ From useId(), never hardcoded — two instances of a form with fixed ids
  // make every label focus the FIRST one's input. See `ui/field.tsx`.
  const ids = useId();

  const [name, setName] = useState(client?.name ?? "");
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? "individual");
  const [source, setSource] = useState<ClientSource | "">(client?.source ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [instagram, setInstagram] = useState(client?.instagram ?? "");
  const [tags, setTags] = useState<string[]>(client?.tags ?? []);

  // Live tags, plus any this client already carries even if archived since —
  // otherwise saving an old client would quietly drop them.
  const [tagWords, setTagWords] = useState(tagVocabulary);
  const tagOptions = vocabOptions(tagWords, "client_tag", client?.tags ?? []).map(
    (v) => ({ value: v.label, label: v.label })
  );
  const [birthday, setBirthday] = useState<string | null>(
    client?.birthday ?? null
  );
  const [city, setCity] = useState(client?.city ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [postalCode, setPostalCode] = useState(client?.postal_code ?? "");
  const [country, setCountry] = useState(client?.country ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");

  /**
   * ⚠️ NOT a validator. `CreateForm` asks once and then proceeds — nothing
   * here can block a save. Only the name is worth asking about; a client with
   * no email is the normal case, not a mistake.
   */
  const emptyFields = name.trim() ? [] : [t("clients.name")];

  const submit = () => {
    const input = {
      name,
      email: email || null,
      phone: phone || null,
      instagram: instagram || null,
      city: city || null,
      notes: notes || null,
      kind,
      source: source || null,
      // Already a list; the action still lowercases, trims and de-duplicates.
      tags,
      birthday,
      address: address || null,
      postalCode: postalCode || null,
      country: country || null,
    };

    // Split rather than a ternary inside `run`: the two actions return
    // different `ActionResult` payloads (a Client vs void), and unifying them
    // in one expression erases the created row's id — which is exactly what
    // the redirect needs.
    if (client) {
      void run(() => updateClientRecord(client.id, input), {
        successMessage: t("clients.clientSaved"),
        errorMessage: t("clients.saveFailed"),
        onSuccess: () => router.push(`/clients/${client.id}`),
      });
      return;
    }

    void run(() => createClientRecord(input), {
      successMessage: t("clients.clientAdded"),
      errorMessage: t("clients.saveFailed"),
      onSuccess: (data) => router.push(data ? `/clients/${data.id}` : "/clients"),
    });
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={client ? t("common.save") : t("clients.addClient")}
    >
      <Field id={`${ids}-name`} label={t("clients.name")}>
        <TextInput
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("clients.namePlaceholder")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${ids}-kind`} label={t("clients.kind")}>
          <Dropdown
            id={`${ids}-kind`}
            value={kind}
            onChange={(v) => setKind(v as ClientKind)}
            options={CLIENT_KINDS.map((k) => ({
              value: k,
              label: t(CLIENT_KIND_KEY[k] as never),
            }))}
            label={t("clients.kind")}
            placeholder={t("clients.kindIndividual")}
          />
        </Field>

        {/* ⚠️ A FIXED LIST, and blank stays blank. "Not recorded" is a real
            answer that the insights panel reports separately from "other". */}
        <Field id={`${ids}-source`} label={t("clients.source")}>
          <Dropdown
            id={`${ids}-source`}
            value={source}
            onChange={(v) => setSource(v as ClientSource | "")}
            options={[
              { value: "", label: t("clients.sourceUnknown") },
              ...CLIENT_SOURCES.map((s) => ({
                value: s,
                label: t(CLIENT_SOURCE_KEY[s] as never),
              })),
            ]}
            label={t("clients.source")}
            placeholder={t("clients.sourceUnknown")}
          />
        </Field>

        <Field id={`${ids}-email`} label={t("clients.email")}>
          <TextInput
            id={`${ids}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field id={`${ids}-phone`} label={t("clients.phone")}>
          <TextInput id={`${ids}-phone`} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>

        <Field id={`${ids}-instagram`} label={t("clients.instagram")}>
          <TextInput
            id={`${ids}-instagram`}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@exxion"
          />
        </Field>

        <Field id={`${ids}-birthday`} label={t("clients.birthday")}>
          <DatePicker
            id={`${ids}-birthday`}
            value={birthday}
            onChange={setBirthday}
          />
        </Field>
      </div>

      <Field
        id={`${ids}-tags`}
        label={t("clients.tags")}
        hint={t("clients.tagsHint")}
      >
        <MultiComboCreate
          id={`${ids}-tags`}
          values={tags}
          onChange={setTags}
          options={tagOptions}
          label={t("clients.tags")}
          placeholder={t("clients.tagsPlaceholder")}
          onCreate={async (label) => {
            const result = await createVocabulary({
              kind: "client_tag",
              label,
            });
            if (!result.ok) return null;
            setTagWords((rows) => [
              ...rows.filter((r) => r.id !== result.data.id),
              result.data,
            ]);
            return result.data.label;
          }}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${ids}-city`} label={t("clients.city")}>
          <TextInput id={`${ids}-city`} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>

        <Field id={`${ids}-country`} label={t("clients.country")}>
          <TextInput id={`${ids}-country`} value={country} onChange={(e) => setCountry(e.target.value)} />
        </Field>

        <Field id={`${ids}-address`} label={t("clients.address")}>
          <TextInput id={`${ids}-address`} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>

        <Field id={`${ids}-postal`} label={t("clients.postalCode")}>
          <TextInput
            id={`${ids}-postal`}
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </Field>
      </div>

      <Field id={`${ids}-notes`} label={t("clients.notes")}>
        <TextArea id={`${ids}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>
    </CreateForm>
  );
}
