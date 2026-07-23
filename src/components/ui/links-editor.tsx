"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UrlInput } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";

const MAX_LINKS = 20;

/**
 * A list of URL rows with add/remove. Deliberately dumb: no client-side
 * validation — `normaliseLinks()` on the server trims, prepends https:// and
 * de-duplicates, so a half-typed "example.com" still saves as a working link.
 *
 * A group of inputs, so a <fieldset>/<legend> rather than ui/field.tsx —
 * Field's single-control `htmlFor` contract doesn't fit. Styled to match.
 */
export function LinksEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (links: string[]) => void;
}) {
  const { t } = useI18n();

  const setAt = (index: number, url: string) =>
    onChange(value.map((v, i) => (i === index ? url : v)));
  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 flex items-baseline gap-1.5 text-xs font-medium text-muted">
        {t("common.links")}
        <span className="text-faint">({t("common.optional")})</span>
      </legend>
      <div className="flex flex-col gap-2">
        {value.map((url, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* URLs are Latin text even in Farsi. */}
            <UrlInput
              dir="ltr"
              value={url}
              onChange={(e) => setAt(index, e.target.value)}
              aria-label={t("common.links")}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeAt(index)}
              aria-label={t("common.remove")}
              icon={<Trash2 aria-hidden className="size-4" />}
              className="shrink-0 text-muted hover:text-danger"
            />
          </div>
        ))}
        {value.length < MAX_LINKS && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([...value, ""])}
            icon={<Plus aria-hidden className="size-4" />}
            className="self-start"
          >
            {t("common.addLink")}
          </Button>
        )}
      </div>
    </fieldset>
  );
}
