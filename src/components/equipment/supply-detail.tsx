"use client";

import { ArrowLeft, PackagePlus, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RestockForm } from "@/components/equipment/supplies-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinksList } from "@/components/ui/links-list";
import { PageHeader, Panel } from "@/components/ui/panel";
import { restockSupply } from "@/lib/actions/equipment";
import { isLowStock } from "@/lib/equipment";
import { useI18n } from "@/lib/i18n/client";
import type { Supply, SupplyRestock } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate, formatMinor } from "@/lib/utils";

export function SupplyDetail({
  supply,
  restocks,
}: {
  supply: Supply;
  /** This supply's restocks, newest first. */
  restocks: SupplyRestock[];
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();

  const [restocking, setRestocking] = useState(false);

  const low = isLowStock(supply);

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <Link
        href="/equipment?tab=supplies"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("equipment.supplies")}
      </Link>

      <PageHeader
        title={supply.name}
        description={[supply.category, supply.item].filter(Boolean).join(" · ")}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/equipment/supplies/${supply.id}/edit`}>
              <Button size="sm" icon={<Pencil aria-hidden className="size-3.5" />}>
                {t("common.edit")}
              </Button>
            </Link>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRestocking(true)}
              icon={<PackagePlus aria-hidden className="size-3.5" />}
            >
              {t("equipment.restock")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <Stat label={t("equipment.quantity")}>
          <span className="flex items-center gap-2">
            <span className="tnum text-lg font-semibold text-ink">
              {formatQuantity(supply.quantity)} {supply.unit}
            </span>
            {low && <Badge tone="warning">{t("equipment.lowStock")}</Badge>}
          </span>
        </Stat>
        <Stat label={t("equipment.lowThreshold")} hint={t("equipment.lowThresholdHint")}>
          <span className="text-sm text-ink">
            {supply.low_threshold == null
              ? "—"
              : `${formatQuantity(supply.low_threshold)} ${supply.unit}`}
          </span>
        </Stat>
        {supply.cost_per_kg_minor != null ? (
          <Stat label={t("equipment.costPerKg")} hint={t("equipment.costPerKgHint")}>
            <span className="tnum text-sm text-ink">
              {formatMinor(supply.cost_per_kg_minor)}
            </span>
          </Stat>
        ) : (
          <Stat label={t("equipment.lastPrice")}>
            <span className="tnum text-sm text-ink">
              {supply.last_price_minor == null
                ? "—"
                : formatMinor(supply.last_price_minor)}
            </span>
          </Stat>
        )}
      </div>

      {supply.notes && (
        <Panel title={t("common.notes")} className="mb-4">
          <p className="text-sm whitespace-pre-wrap text-muted">{supply.notes}</p>
        </Panel>
      )}

      {supply.links.length > 0 && (
        <Panel title={t("common.links")} className="mb-4">
          <LinksList links={supply.links} />
        </Panel>
      )}

      {/* `p-0` in both branches — EmptyState brings its own padding. */}
      <Panel title={t("equipment.restockHistory")} bodyClassName="p-0">
        {restocks.length === 0 ? (
          <EmptyState
            icon={<PackagePlus aria-hidden className="size-4" />}
            title={t("equipment.noRestocks")}
            description={t("equipment.noRestocksHint")}
          />
        ) : (
          <ul>
            {restocks.map((restock) => (
              <li
                key={restock.id}
                className="flex flex-wrap items-center gap-3 row-comfortable border-b border-line last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    +{formatQuantity(restock.quantity)} {supply.unit}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{formatDate(restock.restocked_on, locale)}</span>
                    {restock.transaction_id && (
                      <Badge tone="accent">{t("equipment.loggedInFinance")}</Badge>
                    )}
                  </p>
                </div>
                {restock.cost_minor != null && (
                  <span className="tnum shrink-0 text-sm text-danger">
                    −{formatMinor(restock.cost_minor)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {restocking && (
        <RestockForm
          supply={supply}
          pending={pending}
          onClose={() => setRestocking(false)}
          onSubmit={async (quantity, cost) => {
            const result = await run(
              () => restockSupply({ supplyId: supply.id, quantity, cost }),
              {
                successMessage: t("equipment.restocked"),
                errorMessage: t("equipment.saveFailed"),
              }
            );
            if (result.ok) {
              setRestocking(false);
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

/** `numeric` arrives as a string; at most two decimals, none when whole. */
function formatQuantity(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function Stat({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-0.5 text-2xs text-faint">{hint}</p>}
    </div>
  );
}
