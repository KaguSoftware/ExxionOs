import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { getSessionContext } from "@/lib/data/session";
import { getT } from "@/lib/i18n/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One session read for the whole tree — cache()-wrapped, so the pages below
  // reuse this rather than each paying a round-trip.
  const ctx = await getSessionContext();
  const t = await getT();

  return (
    // ⚠️ `md:items-start` is what lets the sidebar's `sticky top-0 h-dvh`
    // work. A flex row defaults to `items-stretch`, which forces the <aside>
    // to the full PAGE height — so on a long page the rail scrolls away and
    // the account/sign-out footer sits thousands of pixels down.
    <div className="flex min-h-dvh flex-col md:flex-row md:items-start">
      {/* Skip link: without it every navigation puts 7+ tab stops in front of
          the content, on every page. It's visually hidden until focused. */}
      <a
        href="#main"
        // Uses the semantic scale (--z-sticky), not an arbitrary number: it
        // has to clear the mobile header, and nothing else.
        style={{ zIndex: "var(--z-sticky)" }}
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:rounded-lg focus:border focus:border-line focus:bg-raised focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        {t("nav.skipToContent")}
      </a>

      <Sidebar profile={ctx.profile} />
      <MobileNav profile={ctx.profile} />

      {/* `self-stretch` because the row is now `items-start` (see above) —
          without it the main column would only be as tall as its content. */}
      <main id="main" className="min-w-0 flex-1 self-stretch">
        {children}
      </main>
    </div>
  );
}
