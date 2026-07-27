"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { checkImageFile, IMAGE_TYPES } from "@/lib/upload";
import { cn } from "@/lib/utils";

export type StagedImage = { file: File; previewUrl: string };

/**
 * Pictures chosen for a pin that does not exist yet.
 *
 * ⚠️ STAGED IN MEMORY, UPLOADED AFTER THE ROW EXISTS. The standing rule is that
 * nothing is written to the bucket against an id that might never be created —
 * that is how a bucket fills with files no record points at. Holding `File`
 * objects in state respects that completely: the upload happens in the
 * composer's submit, once the pin has a real id, and a cancelled form uploads
 * nothing at all.
 *
 * Previews are object URLs created when a file is added and revoked when it is
 * removed or the form unmounts — an un-revoked one pins the whole image in
 * memory for the life of the tab.
 */
export function ImagePicker({
  value,
  onChange,
}: {
  value: StagedImage[];
  onChange: (images: StagedImage[]) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const inputId = useId();

  const [dragging, setDragging] = useState(false);
  /** Depth counter, not a boolean — a child `dragleave` flickers a boolean. */
  const depth = useRef(0);

  // Revoke every outstanding object URL when the form goes away. Keyed on
  // nothing: this is unmount cleanup, and reading the latest list through a ref
  // keeps the caller's array out of the deps.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  useEffect(
    () => () => {
      for (const item of latest.current) URL.revokeObjectURL(item.previewUrl);
    },
    []
  );

  const add = (files: File[]) => {
    const accepted: StagedImage[] = [];
    for (const file of files) {
      const rejection = checkImageFile(file);
      if (rejection) {
        // Caps are ANNOUNCED, and by NAME — with five files chosen at once,
        // "that image is too big" without a filename is unactionable.
        toast.error(
          `${file.name}: ${
            rejection === "tooBig"
              ? t("inspiration.photoTooBig")
              : t("inspiration.photoWrongType")
          }`
        );
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) onChange([...value, ...accepted]);
  };

  const remove = (target: StagedImage) => {
    URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((item) => item !== target));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">
        {t("inspiration.photos")}
      </span>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          setDragging(true);
        }}
        onDragLeave={() => {
          depth.current -= 1;
          if (depth.current <= 0) {
            depth.current = 0;
            setDragging(false);
          }
        }}
        // Without preventDefault the browser navigates to the dropped file and
        // the half-filled form is gone.
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          depth.current = 0;
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-wrap gap-2 rounded-xl border border-dashed border-line p-3",
          "transition-colors duration-[var(--dur-fast)]",
          "focus-within:border-brand hover:border-line-strong",
          dragging && "border-brand bg-brand-soft"
        )}
      >
        {value.map((item) => (
          <div
            key={item.previewUrl}
            className="group relative size-20 overflow-hidden rounded-lg border border-line bg-raised"
          >
            {/* A local object URL, so no signing and no next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={t("creative.removePhoto")}
              className={cn(
                "absolute end-1 top-1 grid size-5 place-items-center rounded-full",
                "bg-black/60 text-white opacity-0 transition-opacity",
                // Reachable by keyboard and on touch, not hover-only.
                "group-hover:opacity-100 focus-visible:opacity-100"
              )}
            >
              <X aria-hidden className="size-3" />
            </button>
          </div>
        ))}

        <label
          htmlFor={inputId}
          className={cn(
            "grid size-20 cursor-pointer place-items-center gap-1 rounded-lg border border-dashed border-line",
            "text-faint transition-colors hover:border-line-strong hover:text-ink"
          )}
        >
          <ImagePlus aria-hidden className="size-5" />
          <span className="sr-only">{t("inspiration.addPhotos")}</span>
          <input
            id={inputId}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) add(Array.from(e.target.files));
              // Reset, or choosing the SAME file twice fires no change event.
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <span className="text-xs text-faint">{t("inspiration.addPhotosHint")}</span>
    </div>
  );
}
