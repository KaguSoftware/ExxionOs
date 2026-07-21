"use client";

import { useCallback, useState, type RefObject } from "react";

/**
 * Decide whether a popover opens below its trigger or above it.
 *
 * Without this, editing the LAST row of a list means the menu opens off the
 * bottom of the viewport and the page scrolls after every click — which on
 * KaguOs was reported as "the UI jumps around when I edit things".
 *
 * Measured at open time, not on every render: the trigger's position only
 * matters at the moment the menu appears.
 */
export function usePopoverSide(
  triggerRef: RefObject<HTMLElement | null>,
  estimatedHeight = 280
) {
  const [side, setSide] = useState<"bottom" | "top">("bottom");

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    // Flip up only when there genuinely isn't room below AND there is more
    // room above — otherwise a cramped popover moves for no gain.
    setSide(below < estimatedHeight && above > below ? "top" : "bottom");
  }, [triggerRef, estimatedHeight]);

  return { side, measure };
}
