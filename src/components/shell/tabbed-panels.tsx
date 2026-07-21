"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { PageHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * The shared instant-tab shell.
 *
 * ⚠️ TABS ARE PURE CLIENT STATE — NO NAVIGATION, NO REFETCH.
 *
 * Every tab's content is rendered ON THE SERVER and passed in as a prop, so
 * switching tabs swaps already-materialised React elements. A tab that were a
 * route would cost a full round-trip (~305ms) to show data the page already
 * had. This is the single biggest perceived-speed win in the app.
 *
 * The URL still reflects the active tab (`?tab=…`) via `replaceState`, so the
 * view is shareable and survives a refresh — but changing tabs never touches
 * the router, so there is no server work and no history entry per click.
 *
 * Because every panel is already rendered, a panel must not be expensive to
 * render when hidden — keep heavy client work behind the visible branch.
 */
export type PanelTab = {
  id: string;
  label: string;
  /** Server-rendered content for this tab. */
  content: ReactNode;
  /** Optional per-tab header action (a "New …" button). */
  action?: ReactNode;
  /** Right-aligned count on the tab itself. */
  count?: number;
};

export function TabbedPanels({
  title,
  description,
  tabs,
  defaultTab,
}: {
  title: ReactNode;
  description?: ReactNode;
  tabs: PanelTab[];
  defaultTab?: string;
}) {
  const searchParams = useSearchParams();

  // Seeded ONCE from the URL. Re-reading every render would fight the click.
  const [active, setActive] = useState(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    return defaultTab ?? tabs[0]?.id;
  });

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const select = (id: string) => {
    setActive(id);
    // replaceState, not router.push: a push would re-run the server component
    // tree for data we already have on screen.
    const params = new URLSearchParams(window.location.search);
    if (id === (defaultTab ?? tabs[0]?.id)) params.delete("tab");
    else params.set("tab", id);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  };

  return (
    <div className="animate-fade-rise px-4 py-6 md:px-8">
      <PageHeader
        title={title}
        description={description}
        action={current?.action}
      />

      <div
        role="tablist"
        aria-label={typeof title === "string" ? title : undefined}
        className="mb-4 flex gap-1 border-b border-line"
        onKeyDown={(e) => {
          // Arrow keys move between tabs — the expected keyboard model for a
          // tablist, and free once the roles are right.
          const index = tabs.findIndex((t) => t.id === active);
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            // In RTL the arrows swap meaning, so follow the document
            // direction rather than the key name.
            const rtl = document.documentElement.dir === "rtl";
            const forward = (e.key === "ArrowRight") !== rtl;
            const next =
              (index + (forward ? 1 : -1) + tabs.length) % tabs.length;
            select(tabs[next].id);
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(tab.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-[var(--dur-fast)]",
                isActive
                  ? "border-brand font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink"
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="tnum text-xs text-faint">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
