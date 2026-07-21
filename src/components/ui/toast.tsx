"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** The client/server snapshot never changes after hydration, so there is
 *  nothing to subscribe to. */
const subscribeToNothing = () => () => {};

type ToastKind = "success" | "error" | "info" | "loading";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Returns a handle so the caller can resolve the pending toast. */
  loading: (message: string) => { done: (message?: string) => void; fail: (message: string) => void };
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, kind, message }]);
      // A loading toast has no natural end; its handle resolves it.
      if (kind !== "loading") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
        );
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => void push("success", m),
      error: (m) => void push("error", m),
      info: (m) => void push("info", m),
      loading: (m) => {
        const id = push("loading", m);
        const replace = (kind: ToastKind, message: string) => {
          setToasts((list) =>
            list.map((t) => (t.id === id ? { ...t, kind, message } : t))
          );
          timers.current.set(
            id,
            setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
          );
        };
        return {
          done: (message?: string) =>
            message ? replace("success", message) : dismiss(id),
          fail: (message: string) => replace("error", message),
        };
      },
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  // Portals need `document`, which doesn't exist during SSR. `useSyncExternal-
  // Store` is the honest way to ask "am I on the client?": it returns the
  // server snapshot while rendering on the server and the client one after
  // hydration, with no effect and no state-set during render.
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  if (!isClient) return null;

  return createPortal(
    <div
      // ⚠️ NOT a live region itself. Each ToastRow already carries
      // role="alert" (assertive) or role="status" (polite), and a live region
      // nested inside another live region is announced TWICE by NVDA and
      // JAWS. Wrapping an assertive error in a polite container was also
      // contradictory. The rows own the liveness; this is just the viewport.
      className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      style={{ zIndex: "var(--z-toast)" }}
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  loading: Loader2,
} as const;

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const Icon = ICONS[toast.kind];
  // Safe: the root layout mounts I18nProvider OUTSIDE ToastProvider.
  const t = useT();
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={cn(
        "animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3",
        "rounded-lg border border-line bg-raised p-3 shadow-[var(--shadow-3)]"
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.kind === "success" && "text-success",
          toast.kind === "error" && "text-danger",
          toast.kind === "info" && "text-accent",
          toast.kind === "loading" && "animate-spin text-muted"
        )}
      />
      <p className="flex-1 text-sm leading-snug text-ink">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-me-1 -mt-1 rounded p-1 text-faint transition-colors hover:text-ink"
        aria-label={t("common.close")}
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
