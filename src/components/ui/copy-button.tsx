"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";

/** A tiny icon button that copies `text` and confirms with a check mark. */
export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions, http) — stay quiet rather
      // than toast over a nicety.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t("common.copied") : t("common.copy")}
      title={copied ? t("common.copied") : t("common.copy")}
      className="rounded p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
    >
      {copied ? (
        <Check aria-hidden className="size-3.5 text-success" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
    </button>
  );
}
