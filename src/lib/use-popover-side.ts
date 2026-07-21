"use client";

import { useCallback, useState, type RefObject } from "react";

/**
 * Decide where a popover opens relative to its trigger — vertically AND
 * horizontally.
 *
 * Without the vertical half, editing the LAST row of a list means the menu
 * opens off the bottom of the viewport and the page scrolls after every click
 * — which on KaguOs was reported as "the UI jumps around when I edit things".
 *
 * ⚠️ THE HORIZONTAL HALF EXISTS BECAUSE A FIXED-WIDTH POPOVER IS NOT ITS
 * TRIGGER'S WIDTH. `Dropdown` is `inset-x-0`, so it can never overflow — it
 * matches the trigger exactly. `DatePicker` is a fixed 280px panel anchored to
 * the trigger's start edge, so from a narrow trigger near the viewport edge it
 * hangs off-screen: the dashboard reminders row has a `w-36` (144px) trigger,
 * which overhangs by ~136px. Reported as "it opens too far on the edge of the
 * screen and overflows".
 *
 * Measured at open time, not on every render: the trigger's position only
 * matters at the moment the menu appears.
 */
export function usePopoverSide(
  triggerRef: RefObject<HTMLElement | null>,
  estimatedHeight = 280,
  /** Only matters for popovers WIDER than their trigger. */
  estimatedWidth = 0
) {
  const [side, setSide] = useState<"bottom" | "top">("bottom");
  const [align, setAlign] = useState<"start" | "end">("start");

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    // Flip up only when there genuinely isn't room below AND there is more
    // room above — otherwise a cramped popover moves for no gain.
    setSide(below < estimatedHeight && above > below ? "top" : "bottom");

    if (estimatedWidth > 0) {
      // ⚠️ `start`/`end` are LOGICAL, so which physical edge they anchor to
      // flips in RTL. Read the computed direction rather than assuming LTR:
      // Farsi is a first-class locale here, and a hardcoded left/right would
      // fix the bug in English and reintroduce it in Farsi.
      const rtl = getComputedStyle(el).direction === "rtl";
      // Room available when anchored at the trigger's start edge, growing
      // toward its end edge.
      const roomFromStart = rtl ? rect.right : window.innerWidth - rect.left;
      const roomFromEnd = rtl ? window.innerWidth - rect.left : rect.right;
      // Only re-anchor if the flip genuinely helps; otherwise a popover that
      // fits nowhere would jump for nothing.
      setAlign(
        roomFromStart < estimatedWidth && roomFromEnd > roomFromStart
          ? "end"
          : "start"
      );
    }
  }, [triggerRef, estimatedHeight, estimatedWidth]);

  return { side, align, measure };
}
