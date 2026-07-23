"use client";

import { PrintShell } from "@/components/print/print-shell";
import { useI18n } from "@/lib/i18n/client";
import { linesTotalMinor, outstandingMinor, paidMinor } from "@/lib/shipping";
import type {
  AppSettings,
  Client,
  Order,
  OrderLine,
  OrderPayment,
} from "@/lib/types";
import { formatDate, formatMinor } from "@/lib/utils";

/**
 * A printable quote or invoice. A QUOTE shows the agreed price only; an INVOICE
 * also shows what's been received (deposit) and the balance due — the same
 * paid/outstanding numbers the order screen uses (`transactions` is the money,
 * but a quote/invoice is about the agreed price + receipts, which is what
 * order_payments records).
 */
export function Invoice({
  order,
  lines,
  payments,
  client,
  settings,
  isQuote,
}: {
  order: Order;
  lines: OrderLine[];
  payments: OrderPayment[];
  client: Client | null;
  settings: AppSettings | null;
  isQuote: boolean;
}) {
  const { t, locale } = useI18n();

  const subtotal = lines.length ? linesTotalMinor(lines) : order.total_minor;
  const received = paidMinor(payments);
  const owed = outstandingMinor(order, payments);

  const hasBusiness = !!settings?.business_name;

  return (
    <PrintShell backHref={`/shipping/orders/${order.id}`}>
      {/* Quote ⇄ Invoice toggle — screen only. */}
      <div className="mb-6 flex gap-2 print:hidden">
        <a
          href={`/shipping/orders/${order.id}/invoice?kind=quote`}
          className={
            isQuote
              ? "rounded-md bg-[#111827] px-3 py-1 text-sm text-white"
              : "rounded-md border border-[#d1d5db] px-3 py-1 text-sm text-[#4b5563]"
          }
        >
          {t("invoice.quote")}
        </a>
        <a
          href={`/shipping/orders/${order.id}/invoice?kind=invoice`}
          className={
            !isQuote
              ? "rounded-md bg-[#111827] px-3 py-1 text-sm text-white"
              : "rounded-md border border-[#d1d5db] px-3 py-1 text-sm text-[#4b5563]"
          }
        >
          {t("invoice.invoice")}
        </a>
      </div>

      {/* Missing-identity nudge — screen only, never printed. */}
      {!hasBusiness && (
        <p className="mb-6 rounded-md bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e] print:hidden">
          {t("invoice.noBusiness")}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {settings?.business_name || t("invoice.yourBusiness")}
          </h1>
          {settings?.business_address && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#4b5563]">
              {settings.business_address}
            </p>
          )}
          <p className="mt-1 text-sm text-[#4b5563]">
            {[
              settings?.business_phone,
              settings?.business_email,
              settings?.business_instagram ? `@${settings.business_instagram}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="text-end">
          <p className="text-xl font-semibold uppercase tracking-wide">
            {isQuote ? t("invoice.quote") : t("invoice.invoice")}
          </p>
          {order.code && (
            <p className="mt-1 text-sm text-[#4b5563]" dir="ltr">
              {order.code}
            </p>
          )}
          <p className="mt-1 text-sm text-[#4b5563]">
            {formatDate(order.created_at, locale)}
          </p>
        </div>
      </header>

      {/* Bill-to */}
      {client && (
        <section className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            {t("invoice.billTo")}
          </p>
          <p className="mt-1 text-sm font-medium">{client.name}</p>
          <p className="text-sm text-[#4b5563]">
            {[client.phone, client.email, client.city].filter(Boolean).join(" · ")}
          </p>
          {client.address && (
            <p className="whitespace-pre-wrap text-sm text-[#4b5563]">
              {client.address}
            </p>
          )}
        </section>
      )}

      {order.title && (
        <p className="mt-6 text-sm font-medium">{order.title}</p>
      )}

      {/* Line items */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[#111827] text-start">
            <th className="py-2 text-start font-medium">{t("invoice.item")}</th>
            <th className="py-2 text-end font-medium">{t("invoice.qty")}</th>
            <th className="py-2 text-end font-medium">{t("invoice.unitPrice")}</th>
            <th className="py-2 text-end font-medium">{t("invoice.lineTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-[#e5e7eb]">
              <td className="py-2 pe-3">{line.description}</td>
              <td className="py-2 text-end tabular-nums">{line.quantity}</td>
              <td className="py-2 text-end tabular-nums">
                {formatMinor(line.unit_price_minor)}
              </td>
              <td className="py-2 text-end tabular-nums">
                {formatMinor(line.unit_price_minor * line.quantity)}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr className="border-b border-[#e5e7eb]">
              <td className="py-2 pe-3" colSpan={3}>
                {order.title || "—"}
              </td>
              <td className="py-2 text-end tabular-nums">
                {formatMinor(order.total_minor)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs text-sm">
          <Row label={t("invoice.subtotal")} value={formatMinor(subtotal)} />
          {/* An invoice reports receipts + balance; a quote is just the price. */}
          {!isQuote && received > 0 && (
            <>
              <Row label={t("invoice.paid")} value={`− ${formatMinor(received)}`} />
              <Row
                label={t("invoice.balanceDue")}
                value={formatMinor(owed)}
                strong
              />
            </>
          )}
          {(isQuote || received === 0) && (
            <Row
              label={t("invoice.total")}
              value={formatMinor(order.total_minor)}
              strong
            />
          )}
        </dl>
      </div>

      {settings?.invoice_footer && (
        <p className="mt-10 whitespace-pre-wrap border-t border-[#e5e7eb] pt-4 text-sm text-[#4b5563]">
          {settings.invoice_footer}
        </p>
      )}
    </PrintShell>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between border-t-2 border-[#111827] py-2 text-base font-semibold"
          : "flex justify-between py-1"
      }
    >
      <dt className="text-[#4b5563]">{label}</dt>
      <dd className="tabular-nums" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
