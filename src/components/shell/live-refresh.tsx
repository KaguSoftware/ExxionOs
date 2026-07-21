"use client";

import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

/**
 * Mount once per page to keep it live. One line per surface:
 *
 *     <LiveRefresh tables={["reminders"]} />
 *
 * Renders nothing.
 */
export function LiveRefresh({ tables }: { tables: string[] }) {
  useRealtimeRefresh(tables);
  return null;
}
