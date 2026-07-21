"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

const COALESCE_MS = 150;

/**
 * Subscribe to changes on the given tables and re-render the server component
 * tree when any of them change.
 *
 * `router.refresh()` rather than in-place patching is the right default here:
 * the server re-runs the page's own query, so the refreshed data is already
 * filtered and sorted exactly as the page defines it, with no second copy of
 * that logic on the client. Surfaces that need instant feedback do an
 * optimistic update as well, via `useAction`.
 *
 * ⚠️ `realtime.setAuth(token)` is NOT optional. Without it the socket is
 * authorized as anon, so RLS streams nothing — while the channel still reports
 * SUBSCRIBED. The symptom is "live updates work for my own edits but I never
 * see my teammate's", which looks like a caching bug and isn't.
 */
export function useRealtimeRefresh(tables: string[]) {
  const router = useRouter();
  // Join once per distinct table set, not on every render.
  const key = tables.join(",");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      // A single save can emit several row events; coalesce so one save costs
      // one re-render rather than three.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), COALESCE_MS);
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase.channel(`refresh:${key}`);
      for (const table of key.split(",").filter(Boolean)) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleRefresh
        );
      }
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, router]);
}
