"use client";

import { Check } from "lucide-react";

import { MEMBER_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Identity colour picker — a fixed swatch set, never a free colour wheel.
 *
 * A wheel lets someone pick something unreadable on one of the two themes, or
 * indistinguishable from a teammate's. These twenty are pre-checked against
 * both backgrounds.
 */
export function ColorPicker({
  value,
  onChange,
  taken = [],
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  /** Colours already used by someone else — marked, not blocked. */
  taken?: string[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {MEMBER_COLORS.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        const isTaken = taken.some((c) => c.toLowerCase() === color.toLowerCase());
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            // Colour alone can't be the label — a screen reader would hear
            // twenty identical buttons.
            aria-label={isTaken ? `${color} (in use)` : color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "grid size-7 place-items-center rounded-full transition-transform duration-[var(--dur-fast)]",
              "hover:scale-110 focus-visible:scale-110",
              selected && "ring-2 ring-ink ring-offset-2 ring-offset-bg",
              isTaken && !selected && "opacity-45"
            )}
          >
            {selected && (
              <Check aria-hidden className="size-3.5 text-white" strokeWidth={3} />
            )}
          </button>
        );
      })}
    </div>
  );
}
