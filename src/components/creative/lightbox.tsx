"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

/**
 * A full-size photo viewer.
 *
 * ⚠️ THE FULL IMAGE IS SIGNED AT OPEN, never baked in ahead of time — the same
 * rule `SignedFileLink` follows. A render-time signed URL from a private bucket
 * is stale by construction and reads as "the image is broken". No `transform`
 * is passed, so this is the ORIGINAL, not the thumbnail's 240px resize.
 *
 * Escape and a backdrop click close it; focus is sent to the close button on
 * open and the overlay traps nothing heavier than that — it holds one image and
 * one button, so a full focus-trap would be more machinery than the surface
 * needs.
 */
export function Lightbox({
  bucket,
  path,
  alt,
  onClose,
}: {
  bucket: string;
  path: string;
  alt: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from(bucket)
        // 60s: long enough to open and look, short enough that the URL can't be
        // passed around and reused. Same TTL as SignedFileLink.
        .createSignedUrl(path, 60);
      if (!cancelled) setUrl(data?.signedUrl ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while open — same as the create overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="animate-fade-in fixed inset-0 grid place-items-center p-4 backdrop-blur-[2px]"
      style={{ zIndex: "var(--z-modal)", backgroundColor: "var(--scrim)" }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        autoFocus
        className="absolute end-4 top-4 grid size-9 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X aria-hidden className="size-4" />
      </button>

      {url == null || url === "" ? (
        <Loader2 aria-hidden className="size-6 animate-spin text-white/80" />
      ) : (
        // Stop propagation so clicking the image itself doesn't close it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
        />
      )}
    </div>
  );
}
