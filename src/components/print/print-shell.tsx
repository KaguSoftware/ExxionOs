"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/client";

/**
 * Wraps a print document. On SCREEN it shows a light-grey backdrop, a floating
 * toolbar (back link + Print button), and the document as a centred white
 * "page". In PRINT the toolbar and backdrop vanish and the page fills the sheet.
 *
 * Deliberately committed to a LIGHT look regardless of the app theme — a quote
 * printed on dark paper is nobody's intent, and paper is white. The scoped
 * <style> keeps this out of the global token block.
 */
export function PrintShell({
  backHref,
  children,
}: {
  backHref: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>

      <div className="print-toolbar">
        <Link href={backHref} className="print-toolbar-link">
          <ArrowLeft aria-hidden width={16} height={16} className="rtl:rotate-180" />
          {t("common.back")}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="print-toolbar-btn"
        >
          <Printer aria-hidden width={16} height={16} />
          {t("invoice.print")}
        </button>
      </div>

      <div className="print-page">{children}</div>
    </div>
  );
}

// Plain black-on-white document styling. `dir` is inherited from <html>, so the
// document mirrors correctly in Farsi; money stays Latin via formatMinor.
const PRINT_CSS = `
.print-root {
  min-height: 100dvh;
  background: #f4f4f5;
  color: #111827;
  padding: 1.5rem 1rem 4rem;
}
.print-toolbar {
  max-width: 210mm;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.print-toolbar-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: #4b5563;
  text-decoration: none;
}
.print-toolbar-link:hover { color: #111827; }
.print-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  background: #111827;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.875rem;
  cursor: pointer;
}
.print-toolbar-btn:hover { background: #000000; }
.print-page {
  max-width: 210mm;
  margin: 0 auto;
  background: #ffffff;
  color: #111827;
  padding: 18mm 16mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08);
  border-radius: 2px;
}
@media print {
  .print-root { background: #ffffff; padding: 0; }
  .print-toolbar { display: none; }
  .print-page {
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
  }
}
`;
