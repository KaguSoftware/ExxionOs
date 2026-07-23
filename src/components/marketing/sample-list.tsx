"use client";

import { Gift, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { recordSample, deleteSample } from "@/lib/actions/marketing";
import { useI18n } from "@/lib/i18n/client";
import { givenAwayMinor, sampleCostMinor } from "@/lib/marketing";
import type {
  Campaign,
  Client,
  Supply,
  Product,
  Sample,
} from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate, formatMinor } from "@/lib/utils";

/** A product the sample can point at, with its collection for context. */
export type SampleProductOption = {
  id: string;
  name: string;
  collectionName: string;
};

export function SampleList({
  samples,
  products,
  productOptions,
  supplies,
  machineRateMinor,
  clients,
  campaigns,
  today,
}: {
  samples: Sample[];
  /** Full product rows — needed to COST a sample, not just name it. */
  products: Product[];
  productOptions: SampleProductOption[];
  supplies: Supply[];
  machineRateMinor: number;
  clients: Client[];
  campaigns: Campaign[];
  today: string;
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<Sample | null>(null);

  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [quantity, setQuantity] = useState<number | null>(1);
  const [givenOn, setGivenOn] = useState<string | null>(today);
  const [notes, setNotes] = useState("");

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const campaignsById = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c])),
    [campaigns]
  );

  const given = useMemo(
    () => givenAwayMinor(samples, products, supplies, machineRateMinor),
    [samples, products, supplies, machineRateMinor]
  );

  const rows = useMemo(
    () => [...samples].sort((a, b) => b.given_on.localeCompare(a.given_on)),
    [samples]
  );

  const submit = () => {
    void run(
      () =>
        recordSample({
          productId: productId || null,
          description,
          clientId: clientId || null,
          campaignId: campaignId || null,
          recipient: recipient || null,
          quantity: quantity ?? 1,
          givenOn: givenOn ?? today,
          notes: notes || null,
        }),
      {
        successMessage: t("marketing.sampleAdded"),
        errorMessage: t("marketing.saveFailed"),
        onSuccess: () => {
          setComposing(false);
          setProductId("");
          setDescription("");
          setRecipient("");
          setClientId("");
          setCampaignId("");
          setQuantity(1);
          setGivenOn(today);
          setNotes("");
          router.refresh();
        },
      }
    );
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted">
          {/* ⚠️ Says out loud that this is NOT a Finance figure — the single
              most likely misreading on this whole tab. */}
          <span>{t("marketing.givenAway")}: </span>
          <span className="font-medium text-ink tnum">
            {formatMinor(given.totalMinor)}
          </span>
          {given.uncostedCount > 0 && (
            // ⚠️ The uncosted rows are REPORTED, never swallowed — otherwise
            // the total silently under-reports while looking authoritative.
            <span className="ms-2 text-faint" title={t("marketing.uncostedHint")}>
              {t("marketing.uncosted", { count: given.uncostedCount })}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus aria-hidden className="size-3.5" />}
          onClick={() => setComposing(true)}
        >
          {t("marketing.newSample")}
        </Button>
      </div>

      <p className="mb-3 text-2xs text-faint">{t("marketing.sampleHint")}</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Gift aria-hidden className="size-4" />}
          title={t("marketing.noSamples")}
          description={t("marketing.noSamplesHint")}
        />
      ) : (
        <ul className="rounded-xl border border-line">
          {rows.map((sample) => {
            const cost = sampleCostMinor(sample, products, supplies, machineRateMinor);
            const client = sample.client_id ? clientsById.get(sample.client_id) : null;
            const campaign = sample.campaign_id
              ? campaignsById.get(sample.campaign_id)
              : null;

            return (
              <li
                key={sample.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 row-compact border-b border-line last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {sample.quantity > 1 && (
                    <span className="me-1 text-muted tnum">
                      {sample.quantity}×
                    </span>
                  )}
                  {sample.description}
                </span>

                {campaign && <Badge>{campaign.name}</Badge>}

                <span className="text-xs text-muted">
                  {client?.name ?? sample.recipient ?? ""}
                </span>

                {/* ⚠️ "—" when it cannot be costed, NEVER ₺0,00 — a zero would
                    claim the giveaway was free. See sampleCostMinor(). */}
                <span className="w-24 text-end text-sm text-ink tnum">
                  {cost == null ? "—" : formatMinor(cost)}
                </span>

                <span className="w-24 text-end text-2xs text-faint">
                  {formatDate(sample.given_on, locale)}
                </span>

                <button
                  type="button"
                  onClick={() => setDeleting(sample)}
                  aria-label={t("marketing.deleteSample")}
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CreateOverlay
        open={composing}
        title={t("marketing.newSample")}
        description={t("marketing.sampleHint")}
        onClose={() => setComposing(false)}
      >
        <CreateForm
          onSubmit={submit}
          emptyFields={
            productId || description.trim() ? [] : [t("marketing.sampleDescription")]
          }
          pending={pending}
          submitLabel={t("marketing.newSample")}
          onCancel={() => setComposing(false)}
        >
          {/* Linking a product is what makes the sample costable — the hint on
              the list says why it matters. */}
          <Field id={`${ids}-product`} label={t("marketing.sampleProduct")}>
            <Dropdown
              id={`${ids}-product`}
              value={productId}
              onChange={setProductId}
              options={[
                { value: "", label: t("marketing.noProduct") },
                ...productOptions.map((p) => ({
                  value: p.id,
                  label: p.name,
                  hint: p.collectionName,
                })),
              ]}
              label={t("marketing.sampleProduct")}
              placeholder={t("marketing.noProduct")}
            />
          </Field>

          <Field id={`${ids}-desc`} label={t("marketing.sampleDescription")}>
            <TextInput
              id={`${ids}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${ids}-client`} label={t("marketing.sampleClient")}>
              <Dropdown
                id={`${ids}-client`}
                value={clientId}
                onChange={setClientId}
                options={[
                  { value: "", label: t("marketing.noClient") },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
                label={t("marketing.sampleClient")}
                placeholder={t("marketing.noClient")}
              />
            </Field>

            <Field id={`${ids}-recipient`} label={t("marketing.sampleRecipient")}>
              <TextInput
                id={`${ids}-recipient`}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Field>

            <Field id={`${ids}-campaign`} label={t("marketing.sampleCampaign")}>
              <Dropdown
                id={`${ids}-campaign`}
                value={campaignId}
                onChange={setCampaignId}
                options={[
                  { value: "", label: t("marketing.noCampaign") },
                  ...campaigns
                    .filter((c) => !c.archived_at)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
                label={t("marketing.sampleCampaign")}
                placeholder={t("marketing.noCampaign")}
              />
            </Field>

            <Field id={`${ids}-qty`} label={t("marketing.sampleQuantity")}>
              <NumberInput
                id={`${ids}-qty`}
                value={quantity}
                onChange={setQuantity}
                min={1}
                allowDecimal={false}
              />
            </Field>
          </div>

          <Field id={`${ids}-date`} label={t("marketing.sampleDate")}>
            <DatePicker id={`${ids}-date`} value={givenOn} onChange={setGivenOn} />
          </Field>

          <Field id={`${ids}-notes`} label={t("marketing.notes")}>
            <TextArea
              id={`${ids}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </Field>
        </CreateForm>
      </CreateOverlay>

      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={t("marketing.deleteSample")}
        body={t("marketing.deleteSampleBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting
            ? run(() => deleteSample(deleting.id), {
                successMessage: t("marketing.sampleDeleted"),
                errorMessage: t("marketing.saveFailed"),
                onSuccess: () => router.refresh(),
              })
            : undefined
        }
      />
    </>
  );
}
