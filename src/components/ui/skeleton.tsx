import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Product-register rule: skeletons that echo the shape of
 * the content that's coming, never a spinner floating in the middle of a
 * region — a spinner tells you to wait, a skeleton tells you what for.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("skeleton rounded-md", className)}
    />
  );
}

export function SkeletonRows({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
