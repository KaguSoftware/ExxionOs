"use client";

import { ArchiveRestore, Package, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClientForm } from "@/components/clients/client-form";
import { EventTimeline } from "@/components/clients/event-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateOverlay } from "@/components/ui/create";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { archiveClient, unarchiveClient } from "@/lib/actions/clients";
import {
  CLIENT_KIND_KEY,
  CLIENT_SOURCE_KEY,
  clientStats,
  type ClientOrderRow,
} from "@/lib/clients";
import { useI18n } from "@/lib/i18n/client";
import { STAGE_KEY } from "@/lib/shipping";
import type { ClientPnl } from "@/lib/clients";
import type { Client, Event, Order, Vocabulary } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatDate, formatMinor } from "@/lib/utils";

export function ClientDetail({
  client,
  orders,
  revenue,
  pnl,
  events,
  today,
  tagVocabulary = [],
}: {
  client: Client;
  /** This client's orders, newest first. */
  orders: Order[];
  /** Money received by this client, in kuruş — from `transactions`. */
  revenue: number;
  /** Per-client P&L — revenue received vs read-time cost of what they ordered. */
  pnl: ClientPnl;
  events: Event[];
  today: string;
  tagVocabulary?: Vocabulary[];
}) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const rows: ClientOrderRow[] = orders.map((o) => ({
    id: o.id,
    client_id: o.client_id,
    stage: o.stage,
    created_at: o.created_at,
  }));
  const stats = clientStats(
    client.id,
    rows,
    new Map([[client.id, revenue]]),
    today
  );

  return (
    <div className="animate-fade-rise mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            {client.name}
            {client.kind !== "individual" && (
              <Badge>{t(CLIENT_KIND_KEY[client.kind] as never)}</Badge>
            )}
            {client.archived_at && <Badge>{t("clients.archived")}</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {client.source
              ? t(CLIENT_SOURCE_KEY[client.source] as never)
              : t("clients.sourceUnknown")}
            {" · "}
            {t("clients.clientSince")} {formatDate(client.created_at, locale)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil aria-hidden className="size-3.5" />}
            onClick={() => setEditing(true)}
          >
            {t("clients.editClient")}
          </Button>

          {client.archived_at ? (
            <Button
              size="sm"
              variant="ghost"
              loading={pending}
              icon={<ArchiveRestore aria-hidden className="size-3.5" />}
              onClick={() =>
                void run(() => unarchiveClient(client.id), {
                  successMessage: t("clients.unarchived"),
                  onSuccess: () => router.refresh(),
                })
              }
            >
              {t("clients.unarchive")}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setArchiving(true)}>
              {t("clients.archiveClient")}
            </Button>
          )}
        </div>
      </div>

      {/* ⚠️ Lifetime value is MONEY RECEIVED. Not the sum of what was quoted. */}
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("clients.lifetimeValue")} value={formatMinor(revenue)} />
        <Stat label={t("clients.orders")} value={String(stats.orderCount)} />
        <Stat
          label={t("clients.averageOrder")}
          value={
            stats.averageOrderMinor == null
              ? "—"
              : formatMinor(stats.averageOrderMinor)
          }
        />
        <Stat
          label={t("clients.lastOrder")}
          value={
            stats.lastOrderAt
              ? formatDate(stats.lastOrderAt, locale)
              : t("clients.neverOrdered")
          }
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("clients.profile")}>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label={t("clients.email")} value={client.email} />
            <Row label={t("clients.phone")} value={client.phone} />
            <Row
              label={t("clients.instagram")}
              value={client.instagram ? `@${client.instagram}` : null}
            />
            <Row label={t("clients.birthday")} value={
              client.birthday ? formatDate(client.birthday, locale) : null
            } />
            <Row label={t("clients.city")} value={client.city} />
            <Row label={t("clients.address")} value={client.address} />
            <Row label={t("clients.postalCode")} value={client.postal_code} />
            <Row label={t("clients.country")} value={client.country} />
            <Row label={t("clients.notes")} value={client.notes} />
          </dl>

          {client.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {client.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("clients.orderHistory")}>
          {orders.length === 0 ? (
            <EmptyState
              icon={<Package aria-hidden className="size-4" />}
              title={t("clients.neverOrdered")}
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/shipping/orders/${order.id}`}
                    className="flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-raised"
                  >
                    <span className="min-w-0 truncate text-sm text-ink">
                      {order.code ? `${order.code} · ` : ""}
                      {order.title || t("clients.orders")}
                    </span>
                    <span className="shrink-0 text-2xs text-faint">
                      {t(STAGE_KEY[order.stage] as never)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Per-client P&L. ⚠️ Revenue = money received; cost = read-time cost of
            what they ordered; uncosted lines are stated, never counted as free. */}
        <Panel
          title={t("clients.pnl")}
          description={t("clients.pnlHint")}
          className="lg:col-span-2"
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={t("clients.pnlRevenue")}
              value={formatMinor(pnl.revenueMinor)}
            />
            <Stat
              label={t("clients.pnlCost")}
              value={formatMinor(pnl.costMinor)}
            />
            <Stat
              label={t("clients.pnlMargin")}
              value={`${pnl.marginMinor >= 0 ? "+" : "−"}${formatMinor(Math.abs(pnl.marginMinor))}`}
              tone={pnl.marginMinor >= 0 ? "up" : "down"}
            />
          </dl>
          {pnl.uncostedUnits > 0 && (
            <p className="mt-3 border-t border-line pt-2 text-2xs text-faint">
              {t("clients.pnlUncosted", { count: pnl.uncostedUnits })}
            </p>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <EventTimeline clientId={client.id} events={events} today={today} />
        </div>
      </div>

      <CreateOverlay
        open={editing}
        title={t("clients.editClient")}
        onClose={() => setEditing(false)}
      >
        <ClientForm client={client} tagVocabulary={tagVocabulary} />
      </CreateOverlay>

      {/* ⚠️ ARCHIVE, NOT DELETE — and the dialog says what survives, because
          "what happens to my orders" is the question being asked. */}
      <ConfirmDialog
        open={archiving}
        destructive={false}
        loading={pending}
        title={t("clients.archiveClient")}
        body={t("clients.archiveConfirm")}
        confirmLabel={t("clients.archiveClient")}
        onCancel={() => setArchiving(false)}
        onConfirm={() =>
          void run(() => archiveClient(client.id), {
            successMessage: t("clients.archived_"),
            // Close on success so the confirm button's spinner is actually
            // visible while the archive + refresh is in flight. The useAction
            // ref guard already prevents a second fire.
            onSuccess: () => {
              setArchiving(false);
              router.refresh();
            },
          })
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** Margin sign colour — carried by the +/− in the value too, never alone. */
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-medium tnum",
          tone === "up" && "text-success",
          tone === "down" && "text-danger",
          !tone && "text-ink"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-end text-ink break-words">{value}</dd>
    </div>
  );
}
