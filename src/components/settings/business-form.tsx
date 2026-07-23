"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextArea, TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import { updateBusinessSettings } from "@/lib/actions/settings";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { AppSettings } from "@/lib/types";
import { useAction } from "@/lib/use-action";

/**
 * Business identity (printed on quotes/invoices) + the monthly revenue target.
 * All optional — an unset system just shows hints rather than blank headers.
 */
export function BusinessForm({ settings }: { settings: AppSettings | null }) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const nameId = useId();
  const addressId = useId();
  const phoneId = useId();
  const emailId = useId();
  const instagramId = useId();
  const footerId = useId();
  const targetId = useId();

  const [name, setName] = useState(settings?.business_name ?? "");
  const [address, setAddress] = useState(settings?.business_address ?? "");
  const [phone, setPhone] = useState(settings?.business_phone ?? "");
  const [email, setEmail] = useState(settings?.business_email ?? "");
  const [instagram, setInstagram] = useState(settings?.business_instagram ?? "");
  const [footer, setFooter] = useState(settings?.invoice_footer ?? "");
  const [target, setTarget] = useState<number | null>(
    settings?.monthly_target_minor == null
      ? null
      : toMajor(settings.monthly_target_minor)
  );

  const save = () => {
    void run(
      () =>
        updateBusinessSettings({
          businessName: name || null,
          businessAddress: address || null,
          businessPhone: phone || null,
          businessEmail: email || null,
          businessInstagram: instagram || null,
          invoiceFooter: footer || null,
          monthlyTarget: target,
        }),
      {
        successMessage: t("creative.saved"),
        errorMessage: t("creative.saveFailed"),
      }
    );
  };

  return (
    <Panel
      title={t("settings.business")}
      description={t("settings.businessSubtitle")}
    >
      <div className="flex flex-col gap-4">
        <Field id={nameId} label={t("settings.businessName")}>
          <TextInput
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.businessNamePlaceholder")}
          />
        </Field>

        <Field id={addressId} label={t("settings.businessAddress")} optional={t("common.optional")}>
          <TextArea
            id={addressId}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={phoneId} label={t("settings.businessPhone")} optional={t("common.optional")}>
            <TextInput
              id={phoneId}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id={emailId} label={t("settings.businessEmail")} optional={t("common.optional")}>
            <TextInput
              id={emailId}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field id={instagramId} label={t("settings.businessInstagram")} optional={t("common.optional")}>
            <TextInput
              id={instagramId}
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </Field>
        </div>

        <Field
          id={footerId}
          label={t("settings.invoiceFooter")}
          hint={t("settings.invoiceFooterHint")}
          optional={t("common.optional")}
        >
          <TextArea
            id={footerId}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={2}
          />
        </Field>

        <Field
          id={targetId}
          label={t("settings.monthlyTarget")}
          hint={t("settings.monthlyTargetHint")}
          optional={t("common.optional")}
          className="border-t border-line pt-4"
        >
          <MoneyInput id={targetId} value={target} onChange={setTarget} min={0} />
        </Field>

        <div className="flex justify-end">
          <Button variant="primary" onClick={save} loading={pending}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
