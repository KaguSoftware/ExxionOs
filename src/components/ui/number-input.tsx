"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

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
}) {
  const t = useT();

  const clamp = useCallback(
    (n: number) => {
      if (min != null && n < min) return min;
      if (max != null && n > max) return max;
      return n;
    },
    [min, max]
  );

  const handleText = (raw: string) => {
    if (raw.trim() === "") return onChange(null);
    // Accept Persian/Arabic-Indic digits too — a Farsi keyboard produces them,
    // and rejecting them would make the field unusable in that locale.
    const normalized = raw
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/,/g, ".");
    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!pattern.test(normalized)) return;
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) return;
    onChange(parsed);
  };

  const bump = (delta: number) => {
    onChange(clamp((value ?? 0) + delta));
  };

  return (
    <div className={cn("relative flex", className)}>
      <input
        id={id}
        data-no-ring
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => value != null && onChange(clamp(value))}
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
