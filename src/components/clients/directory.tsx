"use client";

import { Download, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import {
  CLIENT_KIND_KEY,
  CLIENT_SOURCE_KEY,
  clientStats,
  type ClientOrderRow,
} from "@/lib/clients";
import { downloadCsv } from "@/lib/csv";
import { clientsToCsv } from "@/lib/entity-export";
import { useI18n } from "@/lib/i18n/client";
import { CLIENT_KINDS, CLIENT_SOURCES } from "@/lib/types";
import type { Client } from "@/lib/types";
import { formatDate, formatMinor } from "@/lib/utils";

/**
 * ⚠️ FILTERING IS 100% CLIENT-SIDE over rows already in memory — every client
 * arrived in the page's single wave. A server round-trip per keystroke would
 * trade ~3ms for ~305ms and gain nothing. Same as `shipping/order-list.tsx`.
 */
export function ClientDirectory({
  clients,
  orders,
  revenue,
  today,
}: {
  clients: Client[];
  orders: ClientOrderRow[];
  revenue: Map<string, number>;
  /** From the server — never computed during render (`react-hooks/purity`). */
  today: string;
}) {
  const { t, locale } = useI18n();

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const allTags = useMemo(() => {
    const seen = new Set<string>();
    for (const c of clients) for (const tg of c.tags) seen.add(tg);
    return [...seen].sort();
  }, [clients]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clients
      .filter((c) => {
        if (!showArchived && c.archived_at) return false;
        if (kind && c.kind !== kind) return false;
        // An UNRECORDED source is not "other" — `__none` selects exactly it.
        if (source === "__none" && c.source !== null) return false;
        if (source && source !== "__none" && c.source !== source) return false;
        if (tag && !c.tags.includes(tag)) return false;
        if (!q) return true;
        return [c.name, c.email, c.phone, c.city, c.instagram, ...c.tags]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q));
      })
      .map((client) => ({
        client,
        stats: clientStats(client.id, orders, revenue, today),
      }))
      // Most valuable first — the ranking that matches the question being
      // asked of a client list. Ties fall back to name so it never jitters.
      .sort(
        (a, b) =>
          b.stats.lifetimeMinor - a.stats.lifetimeMinor ||
          a.client.name.localeCompare(b.client.name)
      );
  }, [clients, orders, revenue, today, query, kind, source, tag, showArchived]);

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users aria-hidden className="size-4" />}
        title={t("clients.noClients")}
        description={t("clients.noClientsHint")}
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("clients.searchPlaceholder")}
          aria-label={t("clients.search")}
          className="w-full sm:w-64"
        />

        <Dropdown
          value={kind}
          onChange={setKind}
          options={[
            { value: "", label: t("clients.allKinds") },
            ...CLIENT_KINDS.map((k) => ({
              value: k,
              label: t(CLIENT_KIND_KEY[k] as never),
              count: clients.filter((c) => c.kind === k).length,
            })),
          ]}
          label={t("clients.kind")}
          placeholder={t("clients.allKinds")}
          className="w-40"
        />

        <Dropdown
          value={source}
          onChange={setSource}
          options={[
            { value: "", label: t("clients.allSources") },
            ...CLIENT_SOURCES.map((s) => ({
              value: s,
              label: t(CLIENT_SOURCE_KEY[s] as never),
              count: clients.filter((c) => c.source === s).length,
            })),
            {
              value: "__none",
              label: t("clients.sourceUnknown"),
              count: clients.filter((c) => c.source === null).length,
            },
          ]}
          label={t("clients.source")}
          placeholder={t("clients.allSources")}
          className="w-44"
        />

        {allTags.length > 0 && (
          <Dropdown
            value={tag}
            onChange={setTag}
            options={[
              { value: "", label: t("clients.allTags") },
              ...allTags.map((tg) => ({
                value: tg,
                label: tg,
                count: clients.filter((c) => c.tags.includes(tg)).length,
              })),
            ]}
            label={t("clients.tags")}
            placeholder={t("clients.allTags")}
            className="w-40"
          />
        )}

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink"
          aria-pressed={showArchived}
        >
          {t("clients.showArchived")}
        </button>

        {/* Exports the FILTERED rows on screen, never the whole table. */}
        <Button
          size="sm"
          onClick={() =>
            downloadCsv(clientsToCsv(rows.map((r) => r.client)), "clients")
          }
          icon={<Download aria-hidden className="size-3.5" />}
          disabled={rows.length === 0}
          className="ms-auto"
        >
          {t("common.exportCsv")}
        </Button>
      </div>

      {/* ⚠️ The list below is `overflow-hidden`, and that is what CLIPS the row
          hover to the rounded corners. The radius lives on the <ul> but
          `hover:bg-raised` lives on each <li>, which has no radius of its own —
          without the clip, the highlight paints square corners over the rounded
          container on the first and last rows. Same fix as the stat grid in
          equipment/machine-detail.tsx. */}
      {rows.length === 0 ? (
        <EmptyState title={t("clients.noMatches")} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line">
          {rows.map(({ client, stats }) => (
            <li
              key={client.id}
              className="border-b border-line transition-colors last:border-0 hover:bg-raised"
            >
              <Link
                href={`/clients/${client.id}`}
                className="row-compact flex flex-wrap items-center gap-x-3 gap-y-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={client.name}>
                  {client.name}
                </span>

                {/* Category is carried by the WORD, in the neutral tone —
                    success/warning/danger are reserved for state. */}
                {client.kind !== "individual" && (
                  <Badge>{t(CLIENT_KIND_KEY[client.kind] as never)}</Badge>
                )}
                {client.archived_at && <Badge>{t("clients.archived")}</Badge>}
                {client.source && (
                  <span className="text-2xs text-faint">
                    {t(CLIENT_SOURCE_KEY[client.source] as never)}
                  </span>
                )}

                <span className="text-xs text-muted tnum">
                  {stats.orderCount} {t("clients.orders").toLowerCase()}
                </span>

                {/* ⚠️ formatMinor, never formatMoney — this is kuruş. */}
                <span className="w-24 text-end text-sm text-ink tnum">
                  {formatMinor(stats.lifetimeMinor)}
                </span>

                <span className="w-28 text-end text-2xs text-faint">
                  {stats.lastOrderAt
                    ? formatDate(stats.lastOrderAt, locale)
                    : t("clients.neverOrdered")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
