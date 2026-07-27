"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { UrlInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { captureFromUrl } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";

/**
 * Paste a URL, get a pin.
 *
 * ⚠️ THE TWO OUTCOMES ARE BOTH SUCCESS, and the copy says which one happened.
 * A site that hands over its `og:image` gives a picture pin; one that doesn't
 * gives a link-only pin. Instagram is always the second kind (its login wall
 * serves no usable preview), and a user who isn't told that concludes the
 * feature is broken rather than that Instagram is being Instagram — hence the
 * hint pointing at Ctrl+V, which does work.
 */
export function UrlCapture({
  boardId,
  onDone,
}: {
  boardId: string | null;
  onDone?: (ideaId: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const inputId = useId();

  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const value = url.trim();
    if (!value || pending) return;

    setPending(true);
    try {
      const result = await captureFromUrl({ url: value, boardId });
      if (!result.ok) {
        // Sentinel codes, never a raw server string — a Farsi user must not
        // be shown an English database error.
        toast.error(
          result.error === "badUrl" ? t("inspiration.badUrl") : result.error
        );
        return;
      }

      setUrl("");
      if (result.data.imageAttached) toast.success(t("inspiration.captured"));
      else toast.info(t("inspiration.linkOnly"));

      router.refresh();
      onDone?.(result.data.ideaId);
    } finally {
      setPending(false);
    }
  };

  return (
    <Field
      id={inputId}
      label={t("inspiration.capture")}
      hint={t("inspiration.captureHint")}
    >
      <div className="flex gap-2">
        <UrlInput
          id={inputId}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("inspiration.capturePlaceholder")}
          // URLs stay Latin and left-to-right even in Farsi — a mirrored
          // https:// is unreadable and un-copyable.
          dir="ltr"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          type="button"
          onClick={() => void submit()}
          loading={pending}
          disabled={!url.trim()}
          icon={<Link2 aria-hidden className="size-4" />}
        >
          {pending ? t("inspiration.fetching") : t("inspiration.fetchUrl")}
        </Button>
      </div>
    </Field>
  );
}
