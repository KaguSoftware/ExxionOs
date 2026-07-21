"use client";

import { useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Short on purpose — see the comment below. */
const TTL_SECONDS = 60;

/**
 * The ONE correct way to open a file in a private bucket.
 *
 * ⚠️ NEVER BAKE A SIGNED URL INTO SERVER-RENDERED HTML. A URL signed during
 * render is stale by construction: the page outlives its own token (router
 * cache, a tab left open, a back-navigation), so a click an hour later carries
 * a dead token and returns
 *
 *     {"statusCode":"400","error":"InvalidJWT",
 *      "message":"\"exp\" claim timestamp check failed"}
 *
 * which reads to the user as "the button does nothing". Raising the TTL does
 * not fix it — it just moves the cliff. This was a real production bug on
 * KaguOs, and it went unnoticed for weeks because an IMMEDIATE click works
 * fine even on the broken build.
 *
 * Signing inside the click handler means the token is always seconds old, so
 * the TTL can be short instead of long.
 *
 * ⚠️ Navigate with `window.location.assign`, NOT `window.open`: awaiting the
 * signing call severs the click from its user gesture, and popup blockers eat
 * the resulting `open()`.
 *
 * Pass a `path`. Never pass a `signedUrl`.
 */
export function SignedFileLink({
  bucket,
  path,
  download,
  children,
  className,
}: {
  bucket: string;
  path: string;
  /** Filename to save as; omit to open in place. */
  download?: string;
  children: ReactNode;
  className?: string;
}) {
  const toast = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, TTL_SECONDS, download ? { download } : undefined);

      if (error || !data?.signedUrl) {
        // Announced, never silent — the original bug's worst quality was that
        // a click appeared not to register at all.
        //
        // ⚠️ The translated string, NOT `error.message`: Supabase errors are
        // always English and often internal ("InvalidJWT: \"exp\" claim
        // timestamp check failed"), which tells a Farsi user nothing and a
        // Turkish workshop nothing either.
        toast.error(t("common.couldNotOpenFile"));
        return;
      }
      window.location.assign(data.signedUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-accent underline-offset-2",
        "transition-opacity hover:underline disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}
