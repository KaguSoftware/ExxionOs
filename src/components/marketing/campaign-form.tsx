"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { CreateForm } from "@/components/ui/create";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { createCampaign, updateCampaign } from "@/lib/actions/marketing";
import { useI18n } from "@/lib/i18n/client";
import { CAMPAIGN_CHANNEL_KEY, CAMPAIGN_STATUS_KEY } from "@/lib/marketing";
import { toMajor } from "@/lib/money";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from "@/lib/types";
import type { Campaign, CampaignChannel, CampaignStatus } from "@/lib/types";
import { useAction } from "@/lib/use-action";

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const ids = useId();

  const [name, setName] = useState(campaign?.name ?? "");
  const [channel, setChannel] = useState<CampaignChannel>(
    campaign?.channel ?? "instagram"
  );
  const [status, setStatus] = useState<CampaignStatus>(
    campaign?.status ?? "planned"
  );
  const [goal, setGoal] = useState(campaign?.goal ?? "");
  const [budget, setBudget] = useState<number | null>(
    campaign?.budget_minor ? toMajor(campaign.budget_minor) : null
  );
  const [startsOn, setStartsOn] = useState<string | null>(campaign?.starts_on ?? null);
  const [endsOn, setEndsOn] = useState<string | null>(campaign?.ends_on ?? null);
  const [notes, setNotes] = useState(campaign?.notes ?? "");

  // ⚠️ Not a validator — `CreateForm` asks once, then proceeds.
  const emptyFields = name.trim() ? [] : [t("marketing.campaignName")];

  const submit = () => {
    const input = {
      name,
      channel,
      status,
      goal: goal || null,
      budget,
      startsOn,
      endsOn,
      notes: notes || null,
    };

    if (campaign) {
      void run(() => updateCampaign(campaign.id, input), {
        successMessage: t("marketing.campaignSaved"),
        errorMessage: t("marketing.saveFailed"),
        onSuccess: () => router.push(`/marketing/campaigns/${campaign.id}`),
      });
      return;
    }

    void run(() => createCampaign(input), {
      successMessage: t("marketing.campaignAdded"),
      errorMessage: t("marketing.saveFailed"),
      onSuccess: (data) =>
        router.push(data ? `/marketing/campaigns/${data.id}` : "/marketing"),
    });
  };

  return (
    <CreateForm
      onSubmit={submit}
      emptyFields={emptyFields}
      pending={pending}
      submitLabel={campaign ? t("common.save") : t("marketing.newCampaign")}
    >
      <Field id={`${ids}-name`} label={t("marketing.campaignName")}>
        <TextInput
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("marketing.campaignNamePlaceholder")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${ids}-channel`} label={t("marketing.channel")}>
          <Dropdown
            id={`${ids}-channel`}
            value={channel}
            onChange={(v) => setChannel(v as CampaignChannel)}
            options={CAMPAIGN_CHANNELS.map((c) => ({
              value: c,
              label: t(CAMPAIGN_CHANNEL_KEY[c] as never),
            }))}
            label={t("marketing.channel")}
            placeholder={t("marketing.channelInstagram")}
          />
        </Field>

        <Field id={`${ids}-status`} label={t("marketing.status")}>
          <Dropdown
            id={`${ids}-status`}
            value={status}
            onChange={(v) => setStatus(v as CampaignStatus)}
            options={CAMPAIGN_STATUSES.map((s) => ({
              value: s,
              label: t(CAMPAIGN_STATUS_KEY[s] as never),
            }))}
            label={t("marketing.status")}
            placeholder={t("marketing.statusPlanned")}
          />
        </Field>
      </div>

      {/* ⚠️ THE PLAN, NOT THE MONEY. The hint says so out loud, because a
          "Budget" field next to a spend figure is exactly where someone would
          assume the two can be added together. Actual spend only ever comes
          from logged costs, each of which writes a real Finance expense. */}
      <Field
        id={`${ids}-budget`}
        label={t("marketing.budget")}
        hint={t("marketing.budgetHint")}
      >
        <MoneyInput id={`${ids}-budget`} value={budget} onChange={setBudget} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${ids}-starts`} label={t("marketing.startsOn")}>
          <DatePicker id={`${ids}-starts`} value={startsOn} onChange={setStartsOn} />
        </Field>

        <Field id={`${ids}-ends`} label={t("marketing.endsOn")}>
          <DatePicker
            id={`${ids}-ends`}
            value={endsOn}
            onChange={setEndsOn}
            min={startsOn ?? undefined}
          />
        </Field>
      </div>

      <Field id={`${ids}-goal`} label={t("marketing.goal")}>
        <TextInput
          id={`${ids}-goal`}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t("marketing.goalPlaceholder")}
        />
      </Field>

      <Field id={`${ids}-notes`} label={t("marketing.notes")}>
        <TextArea
          id={`${ids}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </Field>
    </CreateForm>
  );
}
