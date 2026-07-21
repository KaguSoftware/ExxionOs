"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useId, useState } from "react";

import { SignedFileLink } from "@/components/ui/signed-file-link";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/**
 * Receipt attachment.
 *
 * Uploads go from the BROWSER straight to the bucket (RLS-gated), and only the
 * resulting path is sent to the server action — a file never round-trips
 * through the Next server, which would double the transfer and hold a
 * serverless function open for the duration.
 *
 * ⚠️ The path is stored, NEVER a signed URL. Viewing mints a 60s URL in the
 * click handler via `SignedFileLink`; a URL signed at render is stale by
 * construction and reads to the user as a dead button.
 */
export function ReceiptField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    // Caps are ANNOUNCED, never silently enforced — a file that vanishes
    // without explanation is the worst version of this.
    if (file.size > MAX_BYTES) {
      toast.error(t("finance.receiptTooBig"));
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error(t("finance.receiptWrongType"));
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      // crypto.randomUUID keeps two receipts with the same filename apart.
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: false });

      if (error) {
        toast.error(error.message);
        return;
      }
      onChange(path);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{t("finance.receipt")}</span>

      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <FileText aria-hidden className="size-4 shrink-0 text-faint" />
          <SignedFileLink bucket="receipts" path={value} className="flex-1 text-start">
            {t("finance.viewReceipt")}
          </SignedFileLink>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("finance.removeReceipt")}
            className="rounded p-1 text-faint transition-colors hover:text-danger"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line",
            "px-3 py-2.5 text-sm text-muted transition-colors",
            "hover:border-line-strong hover:text-ink",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <Paperclip aria-hidden className="size-4 shrink-0" />
          {uploading ? t("finance.uploading") : t("finance.attachReceipt")}
          <input
            id={inputId}
            type="file"
            accept={ALLOWED.join(",")}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              // Reset so picking the same file twice still fires onChange.
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
