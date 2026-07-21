"use client";

import { useCallback, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type RunOptions<T> = {
  /** Applied immediately, before the server is asked. */
  optimistic?: () => void;
  /** Undo the optimistic change. Called only if the server rejects. */
  rollback?: () => void;
  onSuccess?: (data: T) => void;
  /** Shown on success. Omit for silent success — the UI already changed. */
  successMessage?: string;
  /** Overrides the server's own error text. */
  errorMessage?: string;
};

/**
 * The one way client components call server actions.
 *
 * Optimistic update → run → roll back and toast if the server says no. The
 * rollback matters more than it looks: without it a rejected write leaves the
 * screen showing something that isn't true, which is worse than an error.
 *
 * ⚠️ When the SUCCESS message is the point (a batch action reporting
 * "Updated 7 · 3 skipped"), call the action directly instead — this helper
 * deliberately only surfaces failures unless you pass `successMessage`.
 */
export function useAction() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
      options: RunOptions<T> = {}
    ): Promise<ActionResult<T>> => {
      const { optimistic, rollback, onSuccess, successMessage, errorMessage } =
        options;

      optimistic?.();
      setRunning(true);

      try {
        const result = await action();

        if (!result.ok) {
          rollback?.();
          toast.error(errorMessage ?? result.error);
          return result;
        }

        if (successMessage) toast.success(successMessage);
        // Wrapped so any router.refresh() the caller triggers is batched with
        // the state update rather than tearing.
        startTransition(() => onSuccess?.(result.data));
        return result;
      } catch (error) {
        rollback?.();
        const message =
          errorMessage ??
          (error instanceof Error ? error.message : "Something went wrong.");
        toast.error(message);
        return { ok: false, error: message };
      } finally {
        setRunning(false);
      }
    },
    [toast]
  );

  return { run, pending: pending || running };
}
