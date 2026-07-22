import { AppearanceForm } from "@/components/settings/appearance-form";
import { CostingForm } from "@/components/settings/costing-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/ui/panel";
import { selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const settings = await selectOrThrow<AppSettings>(
    "settings.app",
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
  );

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader titleKey="settings.title" descriptionKey="settings.subtitle" />

        <div className="flex flex-col gap-4">
          <ProfileForm profile={ctx.profile} email={ctx.email} />
          <AppearanceForm profile={ctx.profile} />
          <CostingForm
            machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
