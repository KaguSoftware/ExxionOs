import { Skeleton } from "@/components/ui/skeleton";

/**
 * The segment-wide loading fallback.
 *
 * Every route here is server-rendered and dynamic, so a navigation blocked on
 * the slowest query in the page's `Promise.all` — a full round-trip (~305ms,
 * the number the whole data layer is tuned around) — with NOTHING on screen
 * acknowledging the click. The `.skeleton` utility and this component existed
 * already; no route ever used them, so the app had no route-level loading
 * state at all.
 *
 * The shape is deliberately the shape every page here shares: a title, a line
 * of description, then a panel. It echoes what is coming rather than spinning,
 * which is the product-register rule — a spinner says "wait", a skeleton says
 * what for.
 */
export default function AppLoading() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2.5 h-4 w-72" />

      <div className="mt-6 rounded-xl border border-line bg-surface p-4">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 flex flex-col gap-2">
          {/* Four rows: enough to read as a list, not so many that a fast
              response flashes a wall of grey. */}
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
