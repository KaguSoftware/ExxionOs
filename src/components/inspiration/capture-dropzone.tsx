"use client";

import { ImagePlus, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { UrlInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { attachImage } from "@/lib/actions/creative";
import { captureFromUrl, createPin } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import {
  IMAGE_TYPES,
  uploadImageToCreative,
  type UploadRejection,
} from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * The capture surface: everything that puts a picture on the wall.
 *
 * ⚠️ THE BAR IS NOT DECORATION — IT IS THE ONLY VISIBLE WAY IN. Drag-and-drop
 * and Ctrl+V are gestures, not affordances: the first version of this section
 * shipped with both and no button, so there was nothing to click and the
 * feature read as broken. A file input you can SEE is the floor; the gestures
 * are the fast path on top of it.
 *
 * ⚠️ THE DROP TARGET IS THE WHOLE WINDOW, not this component's box. A wall that
 * is empty (or short) leaves most of the viewport outside any small dropzone,
 * so a drop aimed at the page did nothing — which is indistinguishable from a
 * broken feature. Listening on `window` means anywhere on the page works, which
 * is what every board app does and what people already expect.
 *
 * ⚠️ A DROPPED IMAGE CREATES ITS PIN IMMEDIATELY — no composer, no modal. That
 * instant is the whole feeling of the thing, and it also means a file is never
 * uploaded against an id that might never exist.
 *
 * ⚠️ THE FOCUS-STEAL TRAP IS AVOIDED STRUCTURALLY: every listener effect has
 * EMPTY deps and reads the current handler through a ref, which is the pattern
 * `CreateOverlay` adopted after inline callbacks in a focus effect's deps
 * un-focused fields after a single keystroke.
 */
export function CaptureDropzone({
  boardId,
  children,
}: {
  /** Where a capture lands. Null on the section root — "Unsorted". */
  boardId: string | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const inputId = useId();

  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  /**
   * ⚠️ A DEPTH COUNTER, NOT A BOOLEAN. Dragging across a child element fires
   * `dragleave` on the ancestor; a boolean flickers the overlay off and on for
   * the whole traverse. Counting enter/leave pairs is the only stable read of
   * "is the pointer still over the window".
   */
  const depth = useRef(0);

  const rejectionMessage = (reason: UploadRejection) =>
    reason === "tooBig"
      ? t("inspiration.photoTooBig")
      : reason === "wrongType"
        ? t("inspiration.photoWrongType")
        : t("inspiration.uploadFailed");

  /** One file → one pin. */
  const addFile = async (file: File) => {
    const created = await createPin({
      // The filename is the only thing a dropped picture tells us about
      // itself, and it usually beats nothing ("brass-lamp-detail.jpg"). A
      // clipboard paste has no name and gets the generic one.
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
      boardId,
    });
    if (!created.ok) {
      toast.error(created.error);
      return;
    }

    const upload = await uploadImageToCreative(file, "idea", created.data.id);
    if (!upload.ok) {
      // Caps are ANNOUNCED, never silent — and the pin survives, so the file
      // can be replaced rather than the whole row lost.
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

  /**
   * Sequential on purpose: a twenty-file drop firing twenty parallel uploads
   * on a workshop connection is twenty slow requests and no legible progress.
   */
  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length > 0) toast.error(t("inspiration.photoWrongType"));
      return;
    }

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

  const addUrl = async (value: string) => {
    const target = value.trim();
    if (!target || fetching) return;

    setFetching(true);
    try {
      const result = await captureFromUrl({ url: target, boardId });
      if (!result.ok) {
        // Sentinel codes, never a raw server string — a Farsi user must not be
        // shown an English database error.
        toast.error(
          result.error === "badUrl" ? t("inspiration.badUrl") : result.error
        );
        return;
      }
      setUrl("");
      // Both outcomes are success, and the copy says WHICH — a link-only pin
      // that looked like a failed one would read as a bug.
      if (result.data.imageAttached) toast.success(t("inspiration.captured"));
      else toast.info(t("inspiration.linkOnly"));
    } finally {
      setFetching(false);
      router.refresh();
    }
  };

  // --- clipboard -----------------------------------------------------------

  const handlePaste = (event: ClipboardEvent) => {
    // ⚠️ Pasting INTO a field stays a normal paste. Without this, typing a
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
    // nothing is worse than one that does the ordinary thing.
  };

  // --- window-level drag and drop ------------------------------------------

  /** True only for an actual FILE drag — a text selection must not arm this. */
  const carriesFiles = (event: DragEvent) => {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return (
      Array.from(types).includes("Files") ||
      Array.from(types).includes("text/uri-list")
    );
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);

    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      void addFiles(files);
      return;
    }

    // ⚠️ Dragging a picture FROM ANOTHER TAB hands over a URL, not a File. A
    // very common gesture that would otherwise silently do nothing.
    const uri =
      event.dataTransfer?.getData("text/uri-list") ||
      event.dataTransfer?.getData("text/plain");
    if (uri && /^https?:\/\/\S+/i.test(uri.trim())) {
      void addUrl(uri.trim().split("\n")[0]);
    }
  };

  /**
   * ⚠️ EMPTY DEPS, FOREVER, plus refs. These handlers are new functions every
   * render; listing them would re-bind four window listeners on every keystroke
   * in the URL field. The refs are synced in their own effect because writing
   * one during render is banned by `react-hooks/refs` here.
   */
  const handlers = useRef({ paste: handlePaste, drop: handleDrop, carriesFiles });
  useEffect(() => {
    handlers.current = { paste: handlePaste, drop: handleDrop, carriesFiles };
  });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => handlers.current.paste(e);
    const onDrop = (e: DragEvent) => handlers.current.drop(e);
    const onEnter = (e: DragEvent) => {
      if (!handlers.current.carriesFiles(e)) return;
      depth.current += 1;
      setDragging(true);
    };
    const onLeave = () => {
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    };
    // Without preventDefault on dragover the browser NAVIGATES to the file,
    // discarding the page — the single most common cause of "drag and drop
    // doesn't work".
    const onOver = (e: DragEvent) => {
      if (handlers.current.carriesFiles(e)) e.preventDefault();
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* THE VISIBLE WAY IN. A label wrapping a hidden input, so the whole
          panel is one big click target and keyboard focus still lands on a
          real file input. */}
      <div
        className={cn(
          "rounded-xl border border-dashed border-line bg-surface p-4",
          "transition-colors duration-[var(--dur-fast)]",
          "focus-within:border-brand hover:border-line-strong",
          dragging && "border-brand bg-brand-soft"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor={inputId}
            aria-busy={busy}
            className={cn(
              "flex flex-1 cursor-pointer items-center gap-3 text-sm",
              busy && "pointer-events-none"
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg",
                busy ? "bg-brand-soft text-brand-text" : "bg-raised text-faint"
              )}
            >
              {busy ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <ImagePlus aria-hidden className="size-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">
                {busy
                  ? t("inspiration.dropping", {
                      done: progress.done,
                      total: progress.total,
                    })
                  : t("inspiration.addPins")}
              </span>
              <span className="block text-xs text-muted">
                {t("inspiration.addPinsHint")}
              </span>
            </span>
            <input
              id={inputId}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void addFiles(Array.from(e.target.files));
                }
                // Reset, or picking the SAME file twice fires no change event.
                e.target.value = "";
              }}
            />
          </label>

          <div className="flex gap-2 sm:w-80">
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
                  void addUrl(url);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void addUrl(url)}
              loading={fetching}
              disabled={!url.trim()}
              icon={<Link2 aria-hidden className="size-4" />}
            >
              {t("inspiration.fetchUrl")}
            </Button>
          </div>
        </div>
      </div>

      {children}

      {/* Portalled: a `fixed` overlay inside a transformed or clipping ancestor
          is constrained to that ancestor's box — the bug that once rendered the
          ⌘K palette as a stray field inside the 56-wide sidebar. */}
      {dragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            style={{ backgroundColor: "var(--scrim)" }}
            className="animate-fade-in pointer-events-none fixed inset-0 z-50 grid place-items-center"
          >
            <span className="flex items-center gap-2 rounded-xl border border-brand bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg">
              <ImagePlus aria-hidden className="size-5" />
              {t("inspiration.dropHere")}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
