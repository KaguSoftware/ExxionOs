import { CampaignForm } from "@/components/marketing/campaign-form";
import { CreatePage } from "@/components/ui/create";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

/**
 * ⚠️ A dedicated spacious surface, per the convention — never an inline
 * expander and never a modal. No data wave: a new campaign depends on nothing
 * that already exists.
 */
export default async function NewCampaignPage() {
  await getSessionContext();
  const t = await getT();

  return (
    <CreatePage
      title={t("marketing.newCampaign")}
      description={t("marketing.subtitle")}
    >
      <CampaignForm />
    </CreatePage>
  );
}
