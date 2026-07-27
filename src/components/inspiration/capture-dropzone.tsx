"use client";

import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import { attachImage } from "@/lib/actions/creative";
import { captureFromUrl, createPin } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import { uploadImageToCreative, type UploadRejection } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * The Pinterest gesture layer: drop images on the wall, or press Ctrl+V.
 *
 * ⚠️ A DROPPED IMAGE CREATES A PIN IMMEDIATELY — no composer, no modal, no
 * "now fill in a title". That instant is the whole feeling of the feature, and
 * it also means we never stage an upload before a parent row exists (the
 * standing storage-contract decision: a file uploaded against an id that is
 * never created is an orphan nobody can find).
 *
 * ⚠️ THE FOCUS-STEAL TRAP IS AVOIDED STRUCTURALLY. Drag handlers are JSX props,
 * not effects, so an inline callback in a dep array is impossible. The one
 * effect here — the paste listener — has EMPTY deps forever and reads the
 * current handler through a ref, which is exactly the pattern `CreateOverlay`
 * adopted after inline `onClose` callbacks made every keystroke re-run a focus
 * effect and un-focus the field after one character.
 */
export function CaptureDropzone({
  boardId,
  children,
}: {
  /** Where a drop lands. Null on the section root — "unsorted". */
  boardId: string | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();

  /**
   * ⚠️ A DEPTH COUNTER, NOT A BOOLEAN. Dragging over a CHILD element fires
   * `dragleave` on this container; a boolean flickers the highlight off and on
   * for the whole traverse. Counting enter/leave pairs is the only stable read
   * of "is the pointer still inside".
   */
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const rejectionMessage = (reason: UploadRejection) =>
    reason === "tooBig"
      ? t("inspiration.photoTooBig")
      : reason === "wrongType"
        ? t("inspiration.photoWrongType")
        : t("inspiration.uploadFailed");

  /**
   * One file → one pin.
   *
   * Sequential by design (see `addFiles`): a twenty-file drop firing twenty
   * parallel inserts would be twenty concurrent uploads on a workshop
   * connection, all slow, with no legible progress.
   */
  const addFile = async (file: File) => {
    const created = await createPin({
      // The filename is the only thing we know about a dropped picture, and it
      // is usually better than nothing ("brass-lamp-detail.jpg"). A clipboard
      // paste has no name, so it gets the generic one.
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
      boardId,
    });
    if (!created.ok) {
      toast.error(created.error);
      return;
    }

    const upload = await uploadImageToCreative(file, "idea", created.data.id);
    if (!upload.ok) {
      // Caps are ANNOUNCED, never silent — and the pin still exists, so the
      // user can attach something else to it rather than losing the row.
      toast.error(upload.message ?? rejectionMessage(upload.reason));
      return;
    }

    const attached = await attachImage({
      parent: "idea",
      parentId: created.data.id,
      path: upload.image.path,
      width: upload.image.width,
      height: upload.image.height,
    });
    if (!attached.ok) toast.error(attached.error);
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    setProgress({ done: 0, total: images.length });
    try {
      for (const [index, file] of images.entries()) {
        await addFile(file);
        setProgress({ done: index + 1, total: images.length });
      }
    } finally {
      setProgress(null);
      router.refresh();
    }
  };

  const addUrl = async (url: string) => {
    setProgress({ done: 0, total: 1 });
    try {
      const result = await captureFromUrl({ url, boardId });
      if (!result.ok) {
        toast.error(
          result.error === "badUrl" ? t("inspiration.badUrl") : result.error
        );
        return;
      }
      // The honest half: a pin exists either way, and the user is told which
      // kind they got rather than being left to wonder why it has no picture.
      if (result.data.imageAttached) toast.success(t("inspiration.captured"));
      else toast.info(t("inspiration.linkOnly"));
    } finally {
      setProgress(null);
      router.refresh();
    }
  };

  // --- clipboard -----------------------------------------------------------

  const handlePaste = (event: ClipboardEvent) => {
    // ⚠️ Pasting INTO a field must stay a normal paste. Without this, typing a
    // title and hitting Ctrl+V would also mint pins behind the form.
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      return;
    }

    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
      // A screenshot has no filename; give it one the pin can wear.
      .map(
        (file) =>
          new File([file], file.name || `${t("inspiration.pastedImage")}.png`, {
            type: file.type,
          })
      );

    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
      return;
    }

    const text = event.clipboardData?.getData("text/plain")?.trim();
    if (text && /^https?:\/\/\S+$/i.test(text)) {
      event.preventDefault();
      void addUrl(text);
    }
    // Anything else: do NOT swallow the event. A paste that silently does
    // nothing is worse than one that does the normal thing.
  };

  /**
   * ⚠️ EMPTY DEPS, FOREVER, plus a ref. `handlePaste` is a new function every
   * render; listing it here would re-bind the listener on every keystroke
   * anywhere on the page. The ref is synced in its own effect because writing
   * one during render is banned by `react-hooks/refs` in this project.
   */
  const pasteRef = useRef(handlePaste);
  useEffect(() => {
    pasteRef.current = handlePaste;
  });

  useEffect(() => {
    const listener = (event: ClipboardEvent) => pasteRef.current(event);
    document.addEventListener("paste", listener);
    return () => document.removeEventListener("paste", listener);
  }, []);

  // --- drag and drop -------------------------------------------------------

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      void addFiles(files);
      return;
    }

    // ⚠️ Dragging a picture FROM ANOTHER TAB hands over a URL, not a File.
    // It is a very common gesture and would otherwise silently do nothing.
    const uri =
      event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if (uri && /^https?:\/\/\S+/i.test(uri.trim())) {
      void addUrl(uri.trim().split("\n")[0]);
    }
  };

  return (
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
      // Without preventDefault the browser NAVIGATES to the dropped file.
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "relative rounded-xl transition-shadow duration-[var(--dur-fast)]",
        // A ring, not a border — it doesn't affect the box, so nothing below
        // shifts by a pixel when a drag enters.
        dragging && "ring-2 ring-brand"
      )}
    >
      {children}

      {dragging && (
        <div
          aria-hidden
          // --scrim, not `bg-black/50`: a named CSS colour is theme-blind, and
          // the token is already tuned per theme. Same call ConfirmDialog makes.
          style={{ backgroundColor: "var(--scrim)" }}
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl"
        >
          <span className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium text-ink shadow-lg">
            <ImagePlus aria-hidden className="size-4" />
            {t("inspiration.dropHere")}
          </span>
        </div>
      )}

      {/* Progress is ANNOUNCED. A twenty-file drop takes real time on a
          workshop connection, and silence there reads as "the drop missed". */}
      {progress && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center"
        >
          <span className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg">
            {t("inspiration.dropping", {
              done: progress.done,
              total: progress.total,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
