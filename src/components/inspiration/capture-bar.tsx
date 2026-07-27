"use client";

import { ImagePlus, Link2 } from "lucide-react";
import { useId, useState } from "react";

import { useCapture } from "@/components/inspiration/capture-listeners";
import { Button } from "@/components/ui/button";
import { UrlInput } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { IMAGE_TYPES } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * The visible way in — a file picker and a URL field, sized to their content.
 *
 * ⚠️ THIS IS NOT THE DROPZONE. Dropping works on the whole window (see
 * `CaptureListeners`); this bar only exists because drag-and-drop and Ctrl+V
 * are gestures, not affordances. The first version of this section shipped
 * with both gestures and no button, so there was nothing to click and adding a
 * picture looked impossible.
 *
 * ⚠️ IT ALSO STOPPED BEING A DASHED BAND. The dashed border said "drop inside
 * me" while the real target was the window — chrome contradicting behaviour —
 * and a `flex-1` label in front of a fixed-width sibling left ~1000px of
 * apparent whitespace that was a live file-dialog click target. Both gone: the
 * controls now size themselves and sit in the wall's own control row.
 */
export function CaptureBar() {
  const { t } = useI18n();
  const { addFiles, addUrl, busy, fetching, lastWasLinkOnly } = useCapture();
  const inputId = useId();
  const [url, setUrl] = useState("");

  const submit = () => {
    void addUrl(url);
    setUrl("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          aria-busy={busy}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface",
            "px-3 py-2 text-sm font-medium text-ink",
            "transition-colors duration-[var(--dur-fast)] hover:border-line-strong",
            "focus-within:border-brand",
            busy && "pointer-events-none opacity-55"
          )}
        >
          <ImagePlus aria-hidden className="size-4 text-faint" />
          {t("inspiration.addPictures")}
          <input
            id={inputId}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(Array.from(e.target.files));
              // Reset, or choosing the SAME file twice fires no change event.
              e.target.value = "";
            }}
          />
        </label>

        <div className="flex max-w-xs flex-1 gap-2">
          <UrlInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("inspiration.capturePlaceholder")}
            aria-label={t("inspiration.capture")}
            // URLs stay Latin and left-to-right even in Farsi — a mirrored
            // https:// is unreadable and un-copyable.
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={submit}
            loading={fetching}
            disabled={!url.trim()}
            icon={<Link2 aria-hidden className="size-4" />}
          >
            {t("inspiration.fetchUrl")}
          </Button>
        </div>
      </div>

      {/* ⚠️ The recovery advice, finally on screen. This string was written to
          stop "capture is broken" being the conclusion when a site refuses its
          picture — and it rendered NOWHERE. Inline and persistent, because a
          toast that has already vanished cannot tell you what to do next. */}
      {lastWasLinkOnly && (
        <p className="text-xs text-muted">{t("inspiration.linkOnlyHint")}</p>
      )}
    </div>
  );
}
