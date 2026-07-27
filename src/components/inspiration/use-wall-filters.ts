"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export type WallFilters = {
  /** A board id, the literal `"unsorted"`, or null for all. */
  board: string | null;
  tag: string | null;
  q: string;
  /** Show pins you decided against. */
  dropped: boolean;
  /** The pin open in the quick-look. */
  pin: string | null;
};

const EMPTY: WallFilters = {
  board: null,
  tag: null,
  q: "",
  dropped: false,
  pin: null,
};

/**
 * The wall's view state, mirrored into the URL.
 *
 * ⚠️ SEEDED ONCE, WRITTEN WITH `replaceState`. Read in a `useState` initialiser
 * — the same shape `tabbed-panels.tsx` uses — because re-reading the params on
 * every render fights the click that just changed them. The write happens
 * inside the event handler, never in an effect, so
 * `react-hooks/set-state-in-effect` stays satisfied.
 *
 * ⚠️ `replaceState`, NOT `pushState`: every chip click would otherwise become a
 * history entry, and Back would walk backwards through every filter you tried
 * rather than leaving the section. The URL exists here for RELOAD and SHARING,
 * not for navigation — the quick-look means opening a pin no longer costs a
 * navigation, so there is nothing for Back to restore.
 *
 * Params are dropped at their default value, so an untouched wall has a clean
 * URL and `?tab=` keeps working alongside.
 */
export function useWallFilters(): [
  WallFilters,
  (patch: Partial<WallFilters>) => void,
] {
  const params = useSearchParams();

  const [filters, setFilters] = useState<WallFilters>(() => ({
    board: params.get("board") ?? null,
    tag: params.get("tag") ?? null,
    q: params.get("q") ?? "",
    dropped: params.get("dropped") === "1",
    pin: params.get("pin") ?? null,
  }));

  const update = (patch: Partial<WallFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const write = (key: string, value: string | null) => {
          if (value) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
        };
        write("board", next.board);
        write("tag", next.tag);
        write("q", next.q.trim() || null);
        write("dropped", next.dropped ? "1" : null);
        write("pin", next.pin);
        window.history.replaceState(null, "", url);
      }

      return next;
    });
  };

  return [filters, update];
}

/** Reset everything a "Clear filters" button should clear — not `pin`. */
export function clearedFilters(): Partial<WallFilters> {
  return { board: EMPTY.board, tag: EMPTY.tag, q: EMPTY.q };
}
