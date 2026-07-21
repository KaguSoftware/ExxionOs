"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { attachImage, detachImage } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { StoredImage } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
/** Thumbnails are signed once per mount; long enough for a browsing session. */
const THUMB_TTL = 60 * 30;

/**
 * Photos on a product or an issue. A warped print is far easier to show than
 * to describe.
 *
 * Uploads go BROWSER → BUCKET (RLS-gated); only the resulting path reaches the
 * server action. A file never round-trips through the Next server, which would
 * double the transfer and hold a function open for the duration.
 *
 * ⚠️ Thumbnails are signed with a `transform`, so the grid downloads a ~20KB
 * resize rather than a 3MB original — on KaguOs that measured a 10× saving.
 * The transform MUST be passed to `createSignedUrl`; appending `&width=` to an
 * already-signed URL silently returns the FULL-SIZE image (the transform is
 * baked into the token, not the query string).
 */
export function ImageStrip({
  parent,
  parentId,
  images,
  onChange,
}: {
  parent: "product" | "issue";
  parentId: string;
  images: StoredImage[];
  onChange?: (images: StoredImage[]) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const inputId = useId();

  const [items, setItems] = useState(images);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  /** Photos whose delete is in flight — see `remove`. */
  const [removingIds, setRemovingIds] = useState<string[]>([]);

  // Adopt server truth during render, never in an effect.
  const [seen, setSeen] = useState(images);
  if (seen !== images) {
    setSeen(images);
    setItems(images);
  }

  // Sign the visible thumbnails. This IS an effect because it's a genuine
  // external subscription (network), not a state mirror.
  useEffect(() => {
    let cancelled = false;
    // No synchronous setState here — with an empty list there is simply
    // nothing to sign, and the render below already falls back to a skeleton
    // for any id without a URL. Clearing state eagerly would be a cascading
    // render for no visible difference.
    if (items.length === 0) return;
    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        items.map(async (image) => {
          const { data } = await supabase.storage
            .from("creative")
            .createSignedUrl(image.path, THUMB_TTL, {
              transform: { width: 240, height: 240, resize: "cover" },
            });
          return [image.id, data?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        // Caps are ANNOUNCED, never silent — a file that vanishes without a
        // word is the worst version of this.
        if (file.size > MAX_BYTES) {
          toast.error(t("creative.photoTooBig"));
          continue;
        }
        if (!ALLOWED.includes(file.type)) {
          toast.error(t("creative.photoWrongType"));
          continue;
        }

        const ext = file.name.split(".").pop() ?? "png";
        const path = `${parent}/${parentId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("creative")
          .upload(path, file, { upsert: false });

        if (error) {
          toast.error(error.message);
          continue;
        }

        const result = await attachImage({ parent, parentId, path });
        if (result.ok) {
          const next = [...items, { id: result.data.id, path, sort_order: 0 }];
          setItems(next);
          onChange?.(next);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * ⚠️ GUARDED AGAINST A SECOND CLICK ON THE SAME PHOTO.
   *
   * `previous` is captured before the request. Two quick removes of DIFFERENT
   * photos each captured their own snapshot, so if the first failed it
   * restored a list that still contained the second — resurrecting a photo the
   * user had already deleted. Rolling back by id instead of by snapshot keeps
   * concurrent removes independent.
   */
  const remove = async (image: StoredImage) => {
    if (removingIds.includes(image.id)) return;
    setRemovingIds((ids) => [...ids, image.id]);

    const next = items.filter((i) => i.id !== image.id);
    setItems(next);
    onChange?.(next);

    const result = await detachImage(parent, image.id);
    if (!result.ok) {
      // Restore just THIS image, in its original position.
      setItems((list) => {
        const restored = [...list, image].sort(
          (a, b) => a.sort_order - b.sort_order
        );
        onChange?.(restored);
        return restored;
      });
      toast.error(result.error);
    }
    setRemovingIds((ids) => ids.filter((id) => id !== image.id));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{t("creative.photos")}</span>

      <div className="flex flex-wrap gap-2">
        {items.map((image) => (
          <div
            key={image.id}
            className="group relative size-20 overflow-hidden rounded-lg border border-line bg-surface"
          >
            {/* A plain <img> is deliberate: these are SHORT-LIVED SIGNED URLs
                from a private bucket. next/image would proxy and cache them,
                and its cached copy would outlive the 30-minute token, so the
                thumbnail would 400 once the signature expired. The bucket's
                own `transform` already does the resizing next/image would.
                The skeleton shows until a URL exists, so `src` is never
                empty — a signing failure degrades to a placeholder, never a
                broken-image box. */}
            {urls[image.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[image.id]}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="skeleton size-full" />
            )}
            <button
              type="button"
              onClick={() => void remove(image)}
              disabled={removingIds.includes(image.id)}
              aria-label={t("creative.removePhoto")}
              className={cn(
                "absolute end-1 top-1 grid size-5 place-items-center rounded-full",
                "bg-black/60 text-white opacity-0 transition-opacity",
                // Reachable by keyboard and on touch, not hover-only.
                "group-hover:opacity-100 focus-visible:opacity-100",
                // Stays visible while its own delete is in flight, so the
                // photo doesn't just sit there looking untouched.
                removingIds.includes(image.id) && "opacity-100"
              )}
            >
              <X aria-hidden className="size-3" />
            </button>
          </div>
        ))}

        {/* ⚠️ THE UPLOAD SAYS IT IS UPLOADING. A 5MB photo on a workshop
            connection took seconds during which the only feedback was a 60%
            opacity fade — indistinguishable from "the click didn't land",
            which is the most likely moment for someone to conclude the app is
            broken. `aria-busy` carries the same fact to a screen reader. */}
        <label
          htmlFor={inputId}
          aria-busy={uploading}
          className={cn(
            "grid size-20 cursor-pointer place-items-center gap-1 rounded-lg border border-dashed border-line",
            "text-faint transition-colors hover:border-line-strong hover:text-ink",
            uploading && "pointer-events-none border-brand-line text-brand-text"
          )}
        >
          {uploading ? (
            <>
              <Loader2 aria-hidden className="size-5 animate-spin" />
              <span className="text-2xs">{t("finance.uploading")}</span>
            </>
          ) : (
            <ImagePlus aria-hidden className="size-5" />
          )}
          <span className="sr-only">
            {uploading ? t("finance.uploading") : t("creative.addPhoto")}
          </span>
          <input
            id={inputId}
            type="file"
            accept={ALLOWED.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
