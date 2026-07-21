"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Field } from "@/components/ui/field";
import { TextInput } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { updateProfile } from "@/lib/actions/settings";
import { useT } from "@/lib/i18n/client";
import type { Profile } from "@/lib/types";
import { useAction } from "@/lib/use-action";

export function ProfileForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const t = useT();
  const { run, pending } = useAction();
  const nameId = useId();

  const [fullName, setFullName] = useState(profile.full_name);
  const [color, setColor] = useState(profile.color);

  const dirty = fullName !== profile.full_name || color !== profile.color;

  const save = () => {
    void run(() => updateProfile({ fullName, color }), {
      // Here the success message IS the feedback — nothing else on screen
      // changes when you rename yourself.
      successMessage: t("settings.saved"),
      errorMessage: t("settings.saveFailed"),
    });
  };

  return (
    <Panel title={t("settings.profile")}>
      <div className="flex flex-col gap-4">
        <Field id={nameId} label={t("settings.fullName")}>
          <TextInput
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">
            {t("settings.yourColor")}
          </span>
          <ColorPicker value={color} onChange={setColor} />
          <p className="text-xs text-faint">{t("settings.colorHint")}</p>
        </div>

        <p className="text-xs text-faint">{email}</p>

        <div className="flex justify-end border-t border-line pt-3">
          <Button
            variant="primary"
            onClick={save}
            loading={pending}
            // Disabled until something actually changed, so the button
            // reflects whether there is anything to save.
            disabled={!dirty}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
