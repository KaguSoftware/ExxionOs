import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
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
 * The PERSIAN body face. The Latin stack has no Arabic-script glyphs, so
 * without this, Farsi fell through to the OS default (Tahoma on Windows) —
 * heavy, blocky, and dated. Vazirmatn is a purpose-built Persian sans (correct
 * گ/ک/ی forms and Persian digits, unlike a generic Arabic-capable Latin face);
 * bundled locally so it never depends on a font CDN. The single variable TTF
 * covers the whole 100–900 weight axis.
 */
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn.ttf",
  variable: "--font-vazir",
  weight: "100 900",
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

/**
 * ⚠️ THE TWO LITERAL COLOURS HERE ARE THE ONE SANCTIONED EXCEPTION to "all
 * colour lives in globals.css". Next serialises `themeColor` into a static
 * `<meta>` tag, which cannot read a CSS variable — so these must track `--bg`
 * BY HAND. They are the sRGB of `oklch(0.155 0.008 262)` and `oklch(1 0 0)`.
 * If the bg tokens ever change, change these in the same commit.
 *
 * Without it, the phone's browser chrome stays its default light grey while
 * the app underneath is near-black — the seam that makes a web app read as a
 * web page. `viewportFit: "cover"` is what makes `env(safe-area-inset-*)`
 * resolve at all, which the mobile sheet needs to clear the home indicator.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
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
      className={`${inter.variable} ${vazirmatn.variable} ${spaceGrotesk.variable} h-full`}
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
