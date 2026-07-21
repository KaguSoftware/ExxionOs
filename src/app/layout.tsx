import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";

import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { directionFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { THEME_COOKIE, resolveThemeAttr } from "@/lib/theme";

import "./globals.css";

// The WORKING family — labels, tables, forms, body. Latin only; Persian text
// falls through to the system Arabic-script face declared in globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The DISPLAY family, matching the logo's heavy geometric grotesque.
 *
 * ⚠️ TITLES AND THE WORDMARK ONLY — never labels, table cells, buttons or form
 * controls. A display face in UI chrome is a product-register anti-pattern: it
 * costs readability exactly where someone is working, and this app is a tool
 * before it is a brand surface. `--font-display` is wired to `.font-display`
 * in globals.css so there is one place that decides what gets it.
 *
 * Latin only, deliberately: Space Grotesk has no Persian glyphs, so Farsi
 * headings fall through to the Arabic-script stack rather than rendering as
 * boxes. That means fa titles read in the body face, which is correct — an
 * unstyled fallback beats a broken one.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ExxionOs",
  description: "Exxion internal system",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = directionFor(locale);

  // Theme is resolved on the SERVER from a cookie, so the correct palette is
  // in the very first byte of HTML. Reading it in a client effect instead
  // would paint the wrong theme for one frame on every hard load — the flash
  // that makes an app feel cheap.
  const cookieStore = await cookies();
  const theme = resolveThemeAttr(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      dir={dir}
      // `data-theme` absent = follow the OS (globals.css makes dark the
      // :root default and light an explicit override).
      data-theme={theme}
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
