"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import type { ActionResult } from "@/lib/types";

/**
 * Returned as `error` when a call was swallowed as a duplicate (see the guard
 * in `run`). A caller that branches on failure can check for it; nothing should
 * ever display it, which is why it is not a translation key.
 */
export const DUPLICATE_CALL = "__duplicate__";

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
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  /**
   * ⚠️ THE DOUBLE-SUBMIT GUARD, AND IT HAS TO BE A REF.
   *
   * `pending` is state: it is not true until React re-renders, so two clicks
   * inside one frame both see `pending === false` and both fire. Disabling the
   * button on `pending` does not close that window either — the second click
   * lands before the disabled attribute is committed. On a delete that means
   * two DELETEs; on a print run it means the filament is deducted twice and
   * the stock ledger is wrong with no way to tell from the UI.
   *
   * A ref flips SYNCHRONOUSLY, inside the same click handler, so the second
   * call returns before it reaches the server. Guarding here covers every
   * caller at once, which is why it lives in the shared hook instead of being
   * re-implemented at each of the ~30 call sites.
   */
  const inFlight = useRef(false);

  const run = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
      options: RunOptions<T> = {}
    ): Promise<ActionResult<T>> => {
      const { optimistic, rollback, onSuccess, successMessage, errorMessage } =
        options;

      if (inFlight.current) {
        // Not an error and NOT toasted: the user double-clicked, which is a
        // normal thing to do. The first call is still handling it, so this one
        // reports the sentinel rather than a failure anyone should show.
        return { ok: false, error: DUPLICATE_CALL };
      }
      inFlight.current = true;

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
          (error instanceof Error
            ? error.message
            : t("common.somethingWentWrong"));
        toast.error(message);
        return { ok: false, error: message };
      } finally {
        inFlight.current = false;
        setRunning(false);
      }
    },
    [toast, t]
  );

  return { run, pending: pending || running };
}
