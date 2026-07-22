"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";

import { controlBase } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * A typed numeric control.
 *
 * ⚠️ Not `<input type="number">` on its own: it accepts "1e5", silently
 * discards non-numeric input without telling anyone, and scroll-wheel over a
 * focused field changes the value — which has quietly corrupted plenty of
 * forms. This uses inputMode="decimal" with an explicit filter instead.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  id,
  placeholder,
  className,
  allowDecimal = true,
  suffix,
  autoFocus,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
  allowDecimal?: boolean;
  suffix?: string;
  autoFocus?: boolean;
  /** Forwarded to the <input>. Order lines name their qty/price boxes this way
      because LineField hides its visible label — without forwarding, those
      inputs had no accessible name at all. */
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const t = useT();

  /**
   * ⚠️ THE DRAFT STRING IS THE FIX FOR "1.05 IS UNTYPEABLE".
   *
   * The field used to render the parsed NUMBER (`value={value ?? ""}`), so an
   * intermediate string could never survive a keystroke: typing "1." parsed to
   * 1 and the field immediately re-rendered as "1", deleting the dot before the
   * next key. "1.0" → 1 → "1", so any price ending in a zero decimal — every
   * ".05", ".50" — was impossible to type. This hit every MoneyInput in the app.
   *
   * `draft` holds exactly what the user typed while they are editing; the parsed
   * number is still lifted to `onChange` when the string is a complete number.
   * `draft === null` means "not editing — show the value from props", which is
   * how an external change (a stepper, a form reset) still displays.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : String(value));

  const clamp = useCallback(
    (n: number) => {
      if (min != null && n < min) return min;
      if (max != null && n > max) return max;
      return n;
    },
    [min, max]
  );

  const handleText = (raw: string) => {
    // Accept Persian/Arabic-Indic digits too — a Farsi keyboard produces them,
    // and rejecting them would make the field unusable in that locale.
    const normalized = raw
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/,/g, ".");
    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    // Reject the keystroke but KEEP the current draft — a stray letter simply
    // does nothing rather than clearing the field.
    if (!pattern.test(normalized)) return;

    setDraft(normalized);

    if (normalized === "") return onChange(null);
    // "1." and a bare "-" are mid-typing, not yet a number — don't commit them,
    // but leave them on screen so the next key completes them.
    if (normalized === "-" || normalized.endsWith(".")) return;
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) return;
    onChange(parsed);
  };

  const bump = (delta: number) => {
    // A stepper is an external change — drop the draft so the new value shows.
    setDraft(null);
    onChange(clamp((value ?? 0) + delta));
  };

  return (
    <div className={cn("relative flex", className)}>
      <input
        id={id}
        data-no-ring
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        onChange={(e) => handleText(e.target.value)}
        // On blur, stop editing (drop the draft) and settle to the clamped
        // value — so "1." resolves to "1" and an out-of-range number snaps in.
        onBlur={() => {
          setDraft(null);
          if (value != null) onChange(clamp(value));
        }}
        // The step buttons are deliberately tabIndex={-1} (they would double
        // every form's tab stops), so without this the stepper has NO keyboard
        // path at all. ArrowUp/ArrowDown is the spinner contract users expect
        // from a numeric field.
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-step);
          }
        }}
        className={cn(
          controlBase,
          "tnum h-9 px-3 pe-16 text-sm",
          // Numbers read left-to-right even in an RTL layout — a figure is not
          // prose, and mirroring it makes "12.50" unreadable.
          "text-start [direction:ltr]"
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-16 flex items-center text-xs text-faint">
          {suffix}
        </span>
      )}
      <div className="absolute inset-y-0 end-0 flex items-center gap-px pe-1">
        <StepButton
          onClick={() => bump(-step)}
          disabled={disabled}
          label={t("common.decrease")}
        >
          <Minus aria-hidden className="size-3" />
        </StepButton>
        <StepButton
          onClick={() => bump(step)}
          disabled={disabled}
          label={t("common.increase")}
        >
          <Plus aria-hidden className="size-3" />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-6 place-items-center rounded text-faint transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Turkish lira amount. Always Latin digits, always LTR — see formatMoney. */
export function MoneyInput(
  props: Omit<React.ComponentProps<typeof NumberInput>, "suffix" | "allowDecimal">
) {
  return <NumberInput {...props} allowDecimal suffix="₺" step={props.step ?? 1} />;
}
