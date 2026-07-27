"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import { pinAspect, sourceLabel } from "@/lib/inspiration";
import type { Idea, IdeaImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One tile on the board.
 *
 * ⚠️ THREE SHAPES, ONE COMPONENT. A photo pin (media box + optional caption), a
 * link-only pin (the site wouldn't give up its picture — a source chip is what
 * distinguishes that from a forgotten note), and a text pin. Splitting them
 * into three components would mean three places to change the card, and the
 * masonry has to flow them interchangeably anyway.
 *
 * ⚠️ The media box's height comes from the STORED intrinsic size, not from the
 * loaded image. That is the entire reason `idea_images.width/height` exist: a
 * card that sizes itself when the picture lands makes every column below it
 * jump, forty times, on every visit.
 */
export function PinCard({
  pin,
  image,
  thumbUrl,
  boardName,
}: {
  pin: Idea;
  image: IdeaImage | undefined;
  /** Signed at the board level, one effect for the whole wall. Undefined
   *  while it resolves — the skeleton covers that, so `src` is never empty. */
  thumbUrl: string | undefined;
  boardName: string | null;
}) {
  const { t } = useI18n();
  const aspect = pinAspect(image);
  const source = sourceLabel(pin.source_url);
  const dropped = pin.status === "dropped";

  return (
    <Link
      href={`/inspiration/pins/${pin.id}`}
      className={cn(
        "group block overflow-hidden rounded-xl border border-line bg-surface",
        "transition-colors hover:border-line-strong",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        // A dropped pin stays on the wall when you ask for it, but it must not
        // compete visually with live ones.
        dropped && "opacity-60"
      )}
    >
      {image ? (
        // ⚠️ The ratio is ALWAYS set, falling back to 4:5 when the dimensions
        // are unknown. An unset height here would leave the box to be sized by
        // the picture, which is precisely the reflow the stored dimensions
        // exist to prevent. Tailwind can't express an arbitrary runtime number,
        // and a class per ratio would be hundreds of one-off utilities.
        <div className="bg-raised" style={{ aspectRatio: aspect ?? 4 / 5 }}>
          {thumbUrl ? (
            /* A plain <img>: these are SHORT-LIVED SIGNED URLs from a private
               bucket. next/image would proxy and cache them, and its copy would
               outlive the token — so the picture would 400 once the signature
               expired. The bucket's own transform already resizes.

               The fade is the section's ONE authored moment: forty thumbnails
               land at forty different times, and popping each one in hard reads
               as jitter. The box is already the right size, so nothing moves. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbUrl}
              alt={pin.title || t("inspiration.untitledPin")}
              className="animate-fade-in size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="skeleton size-full" />
          )}
        </div>
      ) : (
        pin.body && (
          // A text pin still needs presence on a wall of pictures, so the body
          // becomes the tile rather than a footnote under an empty box.
          <p className="line-clamp-6 bg-raised p-4 text-sm leading-relaxed text-ink">
            {pin.body}
          </p>
        )
      )}

      <div className="flex flex-col gap-1.5 p-3">
        {/* A pin with no picture, no title and no notes would otherwise be a
            blank tile you can't tell from a rendering failure. Reachable only
            by deliberately clearing every field, but a card must always say
            what it is. */}
        {(pin.title || (!image && !pin.body)) && (
          <p
            className={cn(
              "line-clamp-2 text-sm font-medium",
              pin.title ? "text-ink" : "text-faint italic",
              dropped && "line-through"
            )}
          >
            {pin.title || t("inspiration.untitledPin")}
          </p>
        )}

        {/* The source chip is what makes a link-only pin legible AS a link-only
            pin, rather than as a picture that failed to load. */}
        {!image && source && (
          <span className="flex items-center gap-1 text-xs text-faint" dir="ltr">
            <Link2 aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{source}</span>
          </span>
        )}

        {(boardName || pin.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {boardName && (
              <span className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted">
                {boardName}
              </span>
            )}
            {/* Two, then a count. A pin with nine tags would otherwise be a
                wall of chips taller than its own picture. */}
            {pin.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded bg-raised px-1.5 py-0.5 text-2xs text-faint"
              >
                {tag}
              </span>
            ))}
            {pin.tags.length > 2 && (
              <span className="text-2xs text-faint">+{pin.tags.length - 2}</span>
            )}
          </div>
        )}

        {pin.status === "made" && (
          <Badge tone="accent">{t("inspiration.statusMade")}</Badge>
        )}
      </div>
    </Link>
  );
}
