import { AppearanceForm } from "@/components/settings/appearance-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/ui/panel";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  const t = await getT();

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

        <div className="flex flex-col gap-4">
          <ProfileForm profile={ctx.profile} email={ctx.email} />
          <AppearanceForm profile={ctx.profile} />
        </div>
      </div>
    </div>
  );
}
