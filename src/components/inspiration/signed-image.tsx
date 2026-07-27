"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * One picture from the private `creative` bucket, signed at mount.
 *
 * ⚠️ The transform goes INTO `createSignedUrl` — appending `&width=` to an
 * already-signed URL silently returns the full-size original, because the
 * transform is baked into the token, not the query string.
 *
 * ⚠️ The effect keys on `[path, size]` and holds NO caller callback, so the
 * focus-steal deps trap cannot apply. A plain `<img>` is deliberate: these are
 * short-lived signed URLs, and `next/image` would cache a copy that outlives
 * the token and then 400.
 */
export function SignedImage({
  path,
  size,
  alt,
  className,
  fallbackClassName,
}: {
  path: string;
  /** Longest edge, passed to the bucket transform. */
  size: number;
  alt: string;
  className?: string;
  /** Shape of the skeleton while the URL resolves. */
  fallbackClassName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("creative")
        .createSignedUrl(path, 60 * 30, {
          transform: { width: size, height: size, resize: "contain" },
        });
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, size]);

  // The skeleton covers the wait, so `src` is never empty — a signing failure
  // degrades to a placeholder rather than a broken-image box.
  if (!url) {
    return <div className={cn("skeleton w-full", fallbackClassName ?? "aspect-[4/5]")} />;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt={alt} className={className} />
  );
}
