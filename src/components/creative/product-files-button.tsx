"use client";

import { Download, FileBox, Loader2, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateOverlay } from "@/components/ui/create";
import { EmptyState } from "@/components/ui/empty-state";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { useToast } from "@/components/ui/toast";
import {
  attachProductFile,
  detachProductFile,
} from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { ProductFile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The design/source formats a product keeps: Maya scenes and the mesh. */
const ALLOWED_EXT = [".mb", ".ma", ".stl"];
/** 3D scenes are big; 200MB is generous but not unbounded. */
const MAX_BYTES = 200 * 1024 * 1024;

/**
 * The source files a product was modelled and sliced from (.mb / .ma / .stl).
 * Sits beside the print-run button — the design lives with the product.
 *
 * ⚠️ Uploads go BROWSER → BUCKET directly (RLS-gated), like photos; only the
 * resulting path reaches the server action, so a 100MB scene never round-trips
 * through the Next server. Files DOWNLOAD via SignedFileLink (signed at click),
 * never a baked-in URL.
 */
export function ProductFilesButton({
  productId,
  files: initial,
}: {
  productId: string;
  files: ProductFile[];
}) {
  const { t } = useI18n();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<ProductFile | null>(null);

  // Adopt server truth during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setFiles(initial);
  }

  const upload = async (list: FileList) => {
    setUploading(true);
    try {
      const supabase = createClient();
      for (const file of Array.from(list)) {
        const lower = file.name.toLowerCase();
        // Caps and rejects are ANNOUNCED, never silent.
        if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
          toast.error(t("creative.fileWrongType"));
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(t("creative.fileTooBig"));
          continue;
        }

        const ext = lower.slice(lower.lastIndexOf("."));
        const path = `product-files/${productId}/${crypto.randomUUID()}${ext}`;
        const { error } = await supabase.storage
          .from("creative")
          .upload(path, file, { upsert: false });
        if (error) {
          toast.error(error.message);
          continue;
        }

        const result = await attachProductFile({
          productId,
          path,
          name: file.name,
          sizeBytes: file.size,
        });
        if (result.ok) {
          setFiles((current) => [
            {
              id: result.data.id,
              product_id: productId,
              path,
              name: file.name,
              size_bytes: file.size,
              created_by: null,
              created_at: result.data.created_at,
            },
            ...current,
          ]);
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (file: ProductFile) => {
    setRemoving(null);
    const previous = files;
    setFiles((current) => current.filter((f) => f.id !== file.id));
    const result = await detachProductFile(file.id);
    if (!result.ok) {
      setFiles(previous);
      toast.error(result.error);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        icon={<FileBox aria-hidden className="size-3.5" />}
      >
        {/* The count earns its place — "Files" alone hides whether any exist. */}
        {files.length > 0
          ? t("creative.filesCount", { count: files.length })
          : t("creative.files")}
      </Button>

      <CreateOverlay
        open={open}
        title={t("creative.productFiles")}
        description={t("creative.productFilesHint")}
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {files.length === 0 ? (
            <EmptyState
              icon={<FileBox aria-hidden className="size-4" />}
              title={t("creative.noFiles")}
              description={t("creative.noFilesHint")}
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-line">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="row-comfortable flex items-center gap-3 border-b border-line last:border-0"
                >
                  <FileBox aria-hidden className="size-4 shrink-0 text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink" title={file.name}>
                      {file.name}
                    </p>
                    {file.size_bytes != null && (
                      <p className="text-2xs text-faint">
                        {formatBytes(file.size_bytes)}
                      </p>
                    )}
                  </div>
                  {/* Sign at click, download with the original filename. */}
                  <SignedFileLink
                    bucket="creative"
                    path={file.path}
                    download={file.name}
                    className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Download aria-hidden className="size-4" />
                    <span className="sr-only">{t("common.download")}</span>
                  </SignedFileLink>
                  <button
                    type="button"
                    onClick={() => setRemoving(file)}
                    aria-label={t("common.delete")}
                    className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-danger"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label
            aria-busy={uploading}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink",
              uploading && "pointer-events-none border-brand-line text-brand-text"
            )}
          >
            {uploading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden className="size-4" />
            )}
            <span>{uploading ? t("finance.uploading") : t("creative.addFile")}</span>
            <input
              type="file"
              accept={ALLOWED_EXT.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-2xs text-faint">{t("creative.fileFormats")}</p>
        </div>
      </CreateOverlay>

      <ConfirmDialog
        open={removing !== null}
        title={t("creative.removeFile")}
        body={t("common.deleteWarning")}
        confirmLabel={t("common.delete")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const file = removing;
          setRemoving(null);
          if (file) void remove(file);
        }}
      />
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
