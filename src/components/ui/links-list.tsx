"use client";

import { ExternalLink } from "lucide-react";

import { linkLabel } from "@/lib/links";

/** External links as new-tab anchors. Renders nothing when the list is empty. */
export function LinksList({ links }: { links: string[] }) {
  if (!links.length) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand-text hover:underline"
          >
            <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            {/* URLs stay Latin/LTR even in Farsi. */}
            <span dir="ltr" className="truncate">
              {linkLabel(url)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
