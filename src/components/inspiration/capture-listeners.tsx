"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/components/ui/toast";
import { attachImage } from "@/lib/actions/creative";
import { captureFromUrl, createPin } from "@/lib/actions/inspiration";
import { useI18n } from "@/lib/i18n/client";
import { uploadImageToCreative, type UploadRejection } from "@/lib/upload";

export type CaptureApi = {
  addFiles: (files: File[]) => Promise<void>;
  addUrl: (url: string) => Promise<void>;
  /** Files are uploading. */
  busy: boolean;
  /** A URL is being fetched. */
  fetching: boolean;
  /** The last capture came back without a picture — worth explaining. */
  lastWasLinkOnly: boolean;
};

const CaptureContext = createContext<CaptureApi | null>(null);

/** The capture verbs. Null outside a `CaptureListeners`, which is a bug. */
export function useCapture(): CaptureApi {
  const api = useContext(CaptureContext);
  if (!api) throw new Error("useCapture must be used inside <CaptureListeners>");
  return api;
}

/**
 * The gesture layer — headless. Owns the window-level paste and drop
 * listeners, the drag overlay, and the progress indicator.
 *
 * ⚠️ MOUNTED OUTSIDE `TabbedPanels`, NOT INSIDE A TAB. `TabbedPanels` renders
 * only the active tab, so when this lived inside the Pins tab the listeners
 * were unmounted on Boards and Tags — Ctrl+V silently did nothing on two of
 * three tabs while the copy promised it unconditionally.
 *
 * ⚠️ THE DROP TARGET IS THE WHOLE WINDOW, not a bordered box. A wall that is
 * empty or short leaves most of the viewport outside any component-sized
 * dropzone, so a drop aimed at the page hit nothing — and the browser was then
 * free to navigate away to the file, discarding the page.
 *
 * ⚠️ EVERY LISTENER EFFECT HAS EMPTY DEPS AND READS THROUGH A REF. Listing a
 * handler would re-bind five window listeners on every keystroke; and an effect
 * keyed on a caller's inline callback is the focus-steal bug that cost a
 * session in July.
 */
export function CaptureListeners({
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

  /**
   * ⚠️ A DEPTH COUNTER, NOT A BOOLEAN. Dragging across a child fires
   * `dragleave` on the ancestor; a boolean flickers the overlay for the whole
   * traverse.
   */
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lastWasLinkOnly, setLastWasLinkOnly] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const rejectionMessage = (reason: UploadRejection) =>
    reason === "tooBig"
      ? t("inspiration.pictureTooBig")
      : reason === "wrongType"
        ? t("inspiration.pictureWrongType")
        : t("inspiration.uploadFailed");

  /** One file → one pin. Returns whether it landed. */
  const addFile = async (file: File): Promise<boolean> => {
    const created = await createPin({
      // The filename is the only thing a dropped picture says about itself,
      // and it usually beats nothing ("brass-lamp-detail.jpg").
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
      boardId,
    });
    if (!created.ok) {
      toast.error(t("inspiration.saveFailed"));
      return false;
    }

    const upload = await uploadImageToCreative(file, "idea", created.data.id);
    if (!upload.ok) {
      // Caps are ANNOUNCED, by name — with five files at once, "that picture is
      // too big" without a filename is unactionable. The pin survives, so
      // something else can be attached to it.
      toast.error(`${file.name}: ${rejectionMessage(upload.reason)}`);
      return false;
    }

    const attached = await attachImage({
      parent: "idea",
      parentId: created.data.id,
      path: upload.image.path,
      width: upload.image.width,
      height: upload.image.height,
    });
    if (!attached.ok) {
      toast.error(t("inspiration.saveFailed"));
      return false;
    }
    return true;
  };

  /**
   * Sequential on purpose: twenty parallel uploads on a workshop connection is
   * twenty slow requests and no legible progress.
   */
  const addFiles = async (files: File[]) => {
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    if (pictures.length === 0) {
      if (files.length > 0) toast.error(t("inspiration.pictureWrongType"));
      return;
    }

    let landed = 0;
    // ⚠️ Set BEFORE the await, or a single-file drop reads "Adding 0 of 1…"
    // for its entire duration and then vanishes.
    setProgress({ done: 1, total: pictures.length });
    try {
      for (const [index, file] of pictures.entries()) {
        setProgress({ done: index + 1, total: pictures.length });
        if (await addFile(file)) landed += 1;
      }
    } finally {
      setProgress(null);
      router.refresh();
    }

    // A successful drop used to produce NO toast while URL capture did — same
    // outcome, one confirmed and one silent.
    if (landed === 1) toast.success(t("inspiration.pinned"));
    else if (landed > 1) {
      toast.success(t("inspiration.pinnedMany", { count: landed }));
    }
  };

  const addUrl = async (value: string) => {
    const target = value.trim();
    if (!target || fetching) return;

    setFetching(true);
    setLastWasLinkOnly(false);
    try {
      const result = await captureFromUrl({ url: target, boardId });
      if (!result.ok) {
        // Sentinel codes only — a raw Postgres string must never reach a
        // Farsi user.
        toast.error(
          result.error === "badUrl"
            ? t("inspiration.badUrl")
            : t("inspiration.saveFailed")
        );
        return;
      }
      // Both outcomes are success, and the copy says WHICH — a link-only pin
      // that read like a failure is how "capture is broken" gets concluded.
      if (result.data.imageAttached) toast.success(t("inspiration.pinned"));
      else {
        setLastWasLinkOnly(true);
        toast.info(t("inspiration.linkOnly"));
      }
    } finally {
      setFetching(false);
      router.refresh();
    }
  };

  // --- clipboard -----------------------------------------------------------

  const handlePaste = (event: ClipboardEvent) => {
    // ⚠️ Pasting INTO a field stays an ordinary paste. Without this, typing a
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

  // --- drag and drop -------------------------------------------------------

  /** True only for a real FILE drag — a text selection must not arm this. */
  const carriesFiles = (event: DragEvent) => {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    const list = Array.from(types);
    return list.includes("Files") || list.includes("text/uri-list");
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

    // ⚠️ Dragging a picture FROM ANOTHER TAB hands over a URL, not a File —
    // a common gesture that would otherwise silently do nothing.
    const uri =
      event.dataTransfer?.getData("text/uri-list") ||
      event.dataTransfer?.getData("text/plain");
    if (uri && /^https?:\/\/\S+/i.test(uri.trim())) {
      void addUrl(uri.trim().split("\n")[0]);
    }
  };

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
    // Without preventDefault on dragover the browser NAVIGATES to the file —
    // the single most common cause of "drag and drop doesn't work".
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

  const api: CaptureApi = {
    addFiles,
    addUrl,
    busy: progress !== null,
    fetching,
    lastWasLinkOnly,
  };

  return (
    <CaptureContext.Provider value={api}>
      {children}

      {/* Portalled: a `fixed` overlay inside a transformed ancestor is
          constrained to that ancestor's box — the bug that once rendered the
          ⌘K palette as a stray field inside the 56-wide sidebar. */}
      {dragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            style={{
              backgroundColor: "var(--scrim)",
              zIndex: "var(--z-overlay)",
            }}
            className="animate-fade-in pointer-events-none fixed inset-0 grid place-items-center"
          >
            <span className="flex items-center gap-2 rounded-xl border border-brand bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg">
              <ImagePlus aria-hidden className="size-5" />
              {t("inspiration.dropHere")}
            </span>
          </div>,
          document.body
        )}

      {/* ⚠️ THE ONLY FEEDBACK for Ctrl+V-of-a-URL and drag-from-another-tab.
          Both fire without touching the bar, and `fetching` used to be shown
          only on a Button that is simultaneously disabled when its field is
          empty — so those paths showed NOTHING for several seconds. Portalled
          so it works on tabs where the bar isn't rendered at all. */}
      {(progress !== null || fetching) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="status"
            style={{ zIndex: "var(--z-toast)" }}
            className="animate-fade-rise fixed bottom-4 end-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg"
          >
            <Loader2 aria-hidden className="size-3.5 animate-spin text-brand-text" />
            {progress
              ? t("inspiration.dropping", {
                  done: progress.done,
                  total: progress.total,
                })
              : t("inspiration.fetching")}
          </div>,
          document.body
        )}
    </CaptureContext.Provider>
  );
}
