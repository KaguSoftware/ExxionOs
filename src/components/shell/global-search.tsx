"use client";

import {
  Boxes,
  Layers,
  Megaphone,
  Package,
  PackageOpen,
  Search,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { globalSearch, type SearchResult, type SearchResultType } from "@/lib/actions/search";
import { useI18n } from "@/lib/i18n/client";

const ICONS: Record<SearchResultType, ReactNode> = {
  client: <Users aria-hidden className="size-4" />,
  order: <PackageOpen aria-hidden className="size-4" />,
  product: <Package aria-hidden className="size-4" />,
  collection: <Layers aria-hidden className="size-4" />,
  supply: <Boxes aria-hidden className="size-4" />,
  campaign: <Megaphone aria-hidden className="size-4" />,
};

const TYPE_KEY: Record<SearchResultType, string> = {
  client: "search.typeClient",
  order: "search.typeOrder",
  product: "search.typeProduct",
  collection: "search.typeCollection",
  supply: "search.typeSupply",
  campaign: "search.typeCampaign",
};

/**
 * ⌘K global search — the one place to find any record by name without first
 * navigating to the right section. Opened by ⌘K / Ctrl+K (or the button in the
 * shell), it fans out one `globalSearch` action across the sections and lets
 * you arrow to a hit and Enter to jump there.
 *
 * ⚠️ The index is fetched ONLY while typing — nothing is loaded up front, so
 * this adds no cost to any page's wave. Results replace the "load once, filter
 * in memory" pattern used within a section because the corpus here spans tables
 * and would be large to hold client-side.
 */
export function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // `for` is the query these results answer — set together in the async
  // callback, never in an effect body (project rule). `loading` is derived:
  // the query has ≥2 chars but the results don't answer it yet.
  const [answer, setAnswer] = useState<{ for: string; results: SearchResult[] }>({
    for: "",
    results: [],
  });
  const [cursor, setCursor] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against a slow earlier query landing after a newer one.
  const seq = useRef(0);

  const trimmed = query.trim();
  const tooShort = trimmed.length < 2;
  const results = answer.for === trimmed ? answer.results : [];
  const loading = !tooShort && answer.for !== trimmed;

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset query/cursor when closing — done here (an event/callback, not an
  // effect body) so there's no cascading-render setState. `answer` can stay; it
  // simply won't match the next query.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  // Focus the input and lock body scroll while open (side effects only — no
  // state writes in the body).
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced search as the query changes. ⚠️ No setState in the effect BODY —
  // that's a project error (cascading renders). The timer callback (async, not
  // the body) owns the single state write, guarded by the sequence so a stale
  // response can't land after a newer keystroke. `loading`/`results` are derived
  // above from whether `answer.for` matches the current query.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const hits = await globalSearch(q);
      if (mine !== seq.current) return;
      setAnswer({ for: q, results: hits });
      setCursor(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const go = useCallback(
    (result: SearchResult) => {
      close();
      router.push(result.href);
    },
    [router, close]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[cursor];
      if (hit) go(hit);
    }
  };

  return (
    <>
      {/* The shell entry point — also announces the shortcut. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink"
      >
        <Search aria-hidden className="size-3.5" />
        <span>{t("search.open")}</span>
        <kbd className="ms-auto hidden rounded border border-line px-1 text-2xs text-faint sm:inline">
          ⌘K
        </kbd>
      </button>

      {/* ⚠️ PORTALLED TO document.body. The trigger lives in the sidebar, which
          is `sticky h-dvh w-56` — a positioned, clipping ancestor. A `fixed`
          overlay rendered inside it gets constrained to that 56-wide box (the
          bug where the search field floated mid-page with no backdrop). Every
          other overlay in the app portals for exactly this reason; see the note
          in ui/create.tsx. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.open")}
            onClick={close}
            className="animate-fade-in fixed inset-0 flex items-start justify-center p-4 pt-[12vh] backdrop-blur-[2px]"
            style={{ zIndex: "var(--z-modal)", backgroundColor: "var(--scrim)" }}
          >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-raised shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search aria-hidden className="size-4 shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("search.placeholder")}
                aria-label={t("search.placeholder")}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="global-search-list"
                className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-faint"
              />
            </div>

            <div id="global-search-list" role="listbox" className="max-h-80 overflow-y-auto">
              {tooShort ? (
                <p className="px-3 py-6 text-center text-xs text-faint">
                  {t("search.hint")}
                </p>
              ) : loading && results.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-faint">
                  {t("search.searching")}
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-faint">
                  {t("search.empty")}
                </p>
              ) : (
                <ul className="py-1">
                  {results.map((hit, i) => (
                    <li key={`${hit.type}-${hit.id}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === cursor}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(hit)}
                        className={
                          "flex w-full items-center gap-3 px-3 py-2 text-start transition-colors " +
                          (i === cursor ? "bg-surface" : "")
                        }
                      >
                        <span className="shrink-0 text-faint">{ICONS[hit.type]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">
                            {hit.title}
                          </span>
                          {hit.subtitle && (
                            <span className="block truncate text-2xs text-faint">
                              {hit.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-2xs text-faint">
                          {t(TYPE_KEY[hit.type] as never)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          </div>,
          document.body
        )
      }
    </>
  );
}
