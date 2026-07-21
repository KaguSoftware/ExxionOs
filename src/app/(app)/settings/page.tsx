import { AppearanceForm } from "@/components/settings/appearance-form";
import { CostingForm } from "@/components/settings/costing-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/ui/panel";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Material } from "@/lib/types";

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  const t = await getT();
  const supabase = await createClient();

  // One wave.
  const [materials, settings, supplies] = await Promise.all([
    rowsOrThrow<Material>(
      "settings.materials",
      supabase.from("materials").select("*").order("name")
    ),
    selectOrThrow<AppSettings>(
      "settings.app",
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
    ),
    // Same wave — lets a material be linked to the stock it draws down.
    rowsOrThrow<{ id: string; name: string; unit: string }>(
      "settings.supplies",
      supabase
        .from("supplies")
        .select("id, name, unit")
        .is("archived_at", null)
        .order("name")
    ),
  ]);

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

        <div className="flex flex-col gap-4">
          <ProfileForm profile={ctx.profile} email={ctx.email} />
          <AppearanceForm profile={ctx.profile} />
          <CostingForm
            materials={materials}
            machineRateMinor={settings.data?.machine_hour_rate_minor ?? 0}
            supplies={supplies}
          />
        </div>
      </div>
    </div>
  );
}
