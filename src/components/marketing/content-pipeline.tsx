"use client";

import { Check, ExternalLink, Instagram, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setProductPosted } from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/utils";

const THUMB_TTL = 60 * 30;

export type ContentImage = { product_id: string; path: string };

type Card = {
  product: Product;
  collectionName: string;
  path: string;
};

/**
 * The Instagram content pipeline: products that HAVE a photo, split into
 * not-posted vs posted. Products with no photo are counted, not listed — a
 * pipeline of things you can't post yet is noise, not a to-do.
 */
export function ContentPipeline({
  products,
  images,
  collectionNames,
}: {
  products: Product[];
  /** One row per product image; the first per product is used as the thumb. */
  images: ContentImage[];
  /** product_id → collection name, for the card subtitle. */
  collectionNames: Record<string, string>;
}) {
  const { t } = useI18n();
  const { run } = useAction();

  // Optimistic posted-state overlay so a click flips instantly.
  const [postedOverride, setPostedOverride] = useState<Record<string, string | null>>(
    {}
  );

  // First image path per product.
  const firstImage = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) {
      if (!map.has(img.product_id)) map.set(img.product_id, img.path);
    }
    return map;
  }, [images]);

  const withPhoto = useMemo(
    () => products.filter((p) => firstImage.has(p.id)),
    [products, firstImage]
  );
  const noPhotoCount = products.length - withPhoto.length;

  const postedOf = (p: Product): string | null =>
    p.id in postedOverride ? postedOverride[p.id] : p.posted_on;

  const cards: Card[] = useMemo(
    () =>
      withPhoto.map((product) => ({
        product,
        collectionName: collectionNames[product.id] ?? "",
        path: firstImage.get(product.id)!,
      })),
    [withPhoto, collectionNames, firstImage]
  );

  const notPosted = cards.filter((c) => postedOf(c.product) == null);
  const posted = cards.filter((c) => postedOf(c.product) != null);

  // Sign visible thumbnails once per mount (browser → bucket, transform to a
  // small resize). Same approach as the product image strip.
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (cards.length === 0) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const entries = await Promise.all(
        cards.map(async (card) => {
          const { data } = await supabase.storage
            .from("creative")
            .createSignedUrl(card.path, THUMB_TTL, {
              transform: { width: 240, height: 240, resize: "cover" },
            });
          return [card.product.id, data?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  const toggle = (product: Product, posted: boolean) => {
    const prev = postedOf(product);
    // Optimistic: today when posting, null when undoing.
    setPostedOverride((o) => ({ ...o, [product.id]: posted ? "today" : null }));
    void run(() => setProductPosted(product.id, posted), {
      rollback: () => setPostedOverride((o) => ({ ...o, [product.id]: prev })),
      successMessage: t("creative.saved"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  if (withPhoto.length === 0) {
    return (
      <EmptyState
        icon={<Instagram aria-hidden className="size-4" />}
        title={t("marketing.contentEmpty")}
        description={
          noPhotoCount > 0
            ? t("marketing.contentNoPhotos", { count: noPhotoCount })
            : t("marketing.contentEmptyHint")
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("marketing.notPosted")}
        count={notPosted.length}
        cards={notPosted}
        urls={urls}
        postedOf={postedOf}
        onToggle={toggle}
      />
      <Section
        title={t("marketing.posted")}
        count={posted.length}
        cards={posted}
        urls={urls}
        postedOf={postedOf}
        onToggle={toggle}
      />

      {noPhotoCount > 0 && (
        <p className="text-xs text-faint">
          {t("marketing.contentNoPhotos", { count: noPhotoCount })}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  cards,
  urls,
  postedOf,
  onToggle,
}: {
  title: string;
  count: number;
  cards: Card[];
  urls: Record<string, string>;
  postedOf: (p: Product) => string | null;
  onToggle: (p: Product, posted: boolean) => void;
}) {
  const { t, locale } = useI18n();
  if (cards.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
        {title}
        <Badge>{count}</Badge>
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ product, collectionName }) => {
          const posted = postedOf(product);
          const isPosted = posted != null;
          return (
            <li
              key={product.id}
              className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div className="aspect-square bg-raised">
                {urls[product.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[product.id]}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="skeleton size-full" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <Link
                    href={`/creative/collections/${product.collection_id}/products/${product.id}`}
                    className="truncate text-sm font-medium text-ink hover:underline"
                    title={product.name}
                  >
                    {product.name}
                  </Link>
                  {collectionName && (
                    <p className="truncate text-xs text-muted">{collectionName}</p>
                  )}
                </div>

                {isPosted && posted !== "today" && (
                  <p className="text-xs text-faint">
                    {t("marketing.postedOn", {
                      date: formatDate(posted, locale),
                    })}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  {isPosted ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggle(product, false)}
                      icon={<Undo2 aria-hidden className="size-3.5" />}
                    >
                      {t("marketing.markUnposted")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onToggle(product, true)}
                      icon={<Check aria-hidden className="size-3.5" />}
                    >
                      {t("marketing.markPosted")}
                    </Button>
                  )}
                  <a
                    href={`/creative/collections/${product.collection_id}/products/${product.id}`}
                    className="ms-auto rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                    aria-label={t("common.edit")}
                  >
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
