"use client";

import { ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { BudgetBar } from "@/components/marketing/campaign-list";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import {
  addCampaignCost,
  archiveCampaign,
  deleteCampaignCost,
  unarchiveCampaign,
} from "@/lib/actions/marketing";
import { useI18n } from "@/lib/i18n/client";
import { CAMPAIGN_CHANNEL_KEY, CAMPAIGN_STATUS_KEY } from "@/lib/marketing";
import type { Campaign, CampaignCost, Sample } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate, formatMinor } from "@/lib/utils";

export function CampaignDetail({
  campaign,
  costs,
  samples,
  today,
}: {
  campaign: Campaign;
  costs: CampaignCost[];
  samples: Sample[];
  today: string;
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [addingCost, setAddingCost] = useState(false);
  const [deletingCost, setDeletingCost] = useState<CampaignCost | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [spentOn, setSpentOn] = useState<string | null>(today);

  const submitCost = () => {
    if (amount == null || amount <= 0) return;
    void run(
      () =>
        addCampaignCost({
          campaignId: campaign.id,
          label,
          amount,
          spentOn: spentOn ?? today,
        }),
      {
        successMessage: t("marketing.costAdded"),
        errorMessage: t("marketing.saveFailed"),
        onSuccess: () => {
          setAddingCost(false);
          setLabel("");
          setAmount(null);
          setSpentOn(today);
          router.refresh();
        },
      }
    );
  };

  return (
    <div className="animate-fade-rise mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            {campaign.name}
            <Badge>{t(CAMPAIGN_STATUS_KEY[campaign.status] as never)}</Badge>
            {campaign.archived_at && <Badge>{t("marketing.archived")}</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(CAMPAIGN_CHANNEL_KEY[campaign.channel] as never)}
            {campaign.starts_on && ` · ${formatDate(campaign.starts_on, locale)}`}
            {campaign.ends_on && ` — ${formatDate(campaign.ends_on, locale)}`}
          </p>
          {campaign.goal && (
            <p className="mt-1 max-w-[65ch] text-sm text-muted">{campaign.goal}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil aria-hidden className="size-3.5" />}
            onClick={() => setEditing(true)}
          >
            {t("common.edit")}
          </Button>
          {campaign.archived_at ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<ArchiveRestore aria-hidden className="size-3.5" />}
              onClick={() =>
                void run(() => unarchiveCampaign(campaign.id), {
                  successMessage: t("marketing.campaignRestored"),
                  onSuccess: () => router.refresh(),
                })
              }
            >
              {t("marketing.unarchive")}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setArchiving(true)}>
              {t("marketing.archiveCampaign")}
            </Button>
          )}
        </div>
      </div>

      <Panel className="mb-4">
        <BudgetBar campaign={campaign} costs={costs} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("marketing.costs")}
          description={t("marketing.spendHint")}
          action={
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus aria-hidden className="size-3.5" />}
              onClick={() => setAddingCost(true)}
            >
              {t("marketing.addCost")}
            </Button>
          }
        >
          {costs.length === 0 ? (
            <EmptyState title={t("marketing.noCosts")} />
          ) : (
            <ul className="flex flex-col gap-1">
              {costs.map((cost) => (
                <li
                  key={cost.id}
                  className="flex items-baseline gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-raised"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {cost.label}
                  </span>
                  <span className="shrink-0 text-2xs text-faint">
                    {formatDate(cost.spent_on, locale)}
                  </span>
                  <span className="shrink-0 text-sm text-ink tnum">
                    {formatMinor(cost.amount_minor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeletingCost(cost)}
                    aria-label={t("marketing.deleteCost")}
                    className="shrink-0 rounded-md p-1 text-faint transition-colors hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("marketing.tabSamples")} description={t("marketing.sampleHint")}>
          {samples.length === 0 ? (
            <EmptyState title={t("marketing.noSamples")} />
          ) : (
            <ul className="flex flex-col gap-1">
              {samples.map((sample) => (
                <li
                  key={sample.id}
                  className="flex items-baseline justify-between gap-3 px-1.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-sm text-ink">
                    {sample.quantity > 1 && (
                      <span className="me-1 text-muted tnum">
                        {sample.quantity}×
                      </span>
                    )}
                    {sample.description}
                  </span>
                  <span className="shrink-0 text-2xs text-faint">
                    {formatDate(sample.given_on, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {campaign.notes && (
        <Panel title={t("marketing.notes")} className="mt-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
            {campaign.notes}
          </p>
        </Panel>
      )}

      {/* ⚠️ Each cost writes ONE real Finance expense via syncTransaction(). */}
      <CreateOverlay
        open={addingCost}
        title={t("marketing.addCost")}
        description={t("marketing.spendHint")}
        onClose={() => setAddingCost(false)}
      >
        <CreateForm
          onSubmit={submitCost}
          emptyFields={label.trim() ? [] : [t("marketing.costLabel")]}
          pending={pending}
          submitLabel={t("marketing.addCost")}
          onCancel={() => setAddingCost(false)}
        >
          <Field id={`${ids}-label`} label={t("marketing.costLabel")}>
            <TextInput
              id={`${ids}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${ids}-amount`} label={t("marketing.costAmount")}>
              <MoneyInput id={`${ids}-amount`} value={amount} onChange={setAmount} />
            </Field>

            <Field id={`${ids}-spent`} label={t("marketing.costDate")}>
              <DatePicker id={`${ids}-spent`} value={spentOn} onChange={setSpentOn} />
            </Field>
          </div>
        </CreateForm>
      </CreateOverlay>

      <CreateOverlay
        open={editing}
        title={t("common.edit")}
        onClose={() => setEditing(false)}
      >
        <CampaignForm campaign={campaign} />
      </CreateOverlay>

      <ConfirmDialog
        open={deletingCost !== null}
        destructive
        title={t("marketing.deleteCost")}
        body={t("marketing.deleteCostBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeletingCost(null)}
        onConfirm={() => {
          const cost = deletingCost;
          setDeletingCost(null);
          if (!cost) return;
          void run(() => deleteCampaignCost(cost.id), {
            successMessage: t("marketing.costDeleted"),
            onSuccess: () => router.refresh(),
          });
        }}
      />

      <ConfirmDialog
        open={archiving}
        destructive={false}
        title={t("marketing.archiveCampaign")}
        body={t("marketing.archiveConfirm")}
        confirmLabel={t("marketing.archiveCampaign")}
        onCancel={() => setArchiving(false)}
        onConfirm={() => {
          setArchiving(false);
          void run(() => archiveCampaign(campaign.id), {
            successMessage: t("marketing.campaignArchived"),
            onSuccess: () => router.refresh(),
          });
        }}
      />
    </div>
  );
}
