"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { Direction } from "@/lib/types";

/**
 * URL-backed Finance filters, so a filtered view is shareable, bookmarkable and
 * survives a refresh.
 *
 * ⚠️ THESE PARAM NAMES ARE THE CONTRACT. Any deep-link into Finance — from the
 * dashboard, from Equipment, from anywhere — must use exactly these keys. The
 * reference project shipped a `?preset=mine` that no page ever read: the link
 * looked filtered and silently landed on an unfiltered board, for months.
 * If you add a filter, add it here first and link against this hook.
 */
export type FinanceFilters = {
  from: string;
  to: string;
  /** Category ids; EMPTY = no filter, never "match nothing". */
  categories: string[];
  direction: Direction | null;
  query: string;
};

export const FINANCE_PARAMS = {
  from: "from",
  to: "to",
  categories: "cat",
  direction: "dir",
  query: "q",
} as const;

export function useFinanceFilters(defaults: { from: string; to: string }) {
  const searchParams = useSearchParams();

  // Seeded ONCE from the URL via a lazy initialiser. Re-reading on every
  // render would fight the user's typing.
  const [filters, setFilters] = useState<FinanceFilters>(() => ({
    from: searchParams.get(FINANCE_PARAMS.from) || defaults.from,
    to: searchParams.get(FINANCE_PARAMS.to) || defaults.to,
    categories:
      searchParams.get(FINANCE_PARAMS.categories)?.split(",").filter(Boolean) ?? [],
    direction: parseDirection(searchParams.get(FINANCE_PARAMS.direction)),
    query: searchParams.get(FINANCE_PARAMS.query) || "",
  }));

  // Mirror state back into the URL.
  // ⚠️ `replaceState`, NEVER `router.push`: a push would cost a server
  // round-trip and stack one history entry per keystroke, so Back would walk
  // letter by letter out of a search box.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.from !== defaults.from) params.set(FINANCE_PARAMS.from, filters.from);
    if (filters.to !== defaults.to) params.set(FINANCE_PARAMS.to, filters.to);
    if (filters.categories.length)
      params.set(FINANCE_PARAMS.categories, filters.categories.join(","));
    if (filters.direction) params.set(FINANCE_PARAMS.direction, filters.direction);
    if (filters.query.trim()) params.set(FINANCE_PARAMS.query, filters.query.trim());

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, [filters, defaults.from, defaults.to]);

  const patch = useCallback((next: Partial<FinanceFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  }, []);

  const reset = useCallback(() => {
    setFilters({
      from: defaults.from,
      to: defaults.to,
      categories: [],
      direction: null,
      query: "",
    });
  }, [defaults.from, defaults.to]);

  const dirty =
    filters.from !== defaults.from ||
    filters.to !== defaults.to ||
    filters.categories.length > 0 ||
    filters.direction !== null ||
    filters.query.trim() !== "";

  return { filters, patch, reset, dirty };
}

function parseDirection(value: string | null): Direction | null {
  return value === "in" || value === "out" ? value : null;
}
