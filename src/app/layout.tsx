import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { directionFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { THEME_COOKIE, resolveThemeAttr } from "@/lib/theme";

import "./globals.css";

// One family, multiple weights — product register. Latin only; Persian text
// falls through to the system Arabic-script face declared in globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
      className={`${inter.variable} h-full`}
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
