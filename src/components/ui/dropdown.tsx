"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useT } from "@/lib/i18n/client";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  /** Right-aligned tabular count. Deliberately NOT `hint`: a count has to sit
   *  on the baseline where the eye compares down the column, not on a second
   *  line of prose. */
  count?: number;
  disabled?: boolean;
};

/** Show the filter box at this many options or more. */
const SEARCH_THRESHOLD = 5;

type BaseProps = {
  options: DropdownOption[];
  /** Required: the trigger shows a VALUE, which is not a label. Without this
   *  the control has no accessible name. */
  label: string;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  searchThreshold?: number;
};

export function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder,
  disabled,
  className,
  id,
  searchThreshold = SEARCH_THRESHOLD,
}: BaseProps & {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <DropdownShell
      id={id}
      label={label}
      disabled={disabled}
      className={className}
      options={options}
      searchThreshold={searchThreshold}
      triggerText={selected ? selected.label : placeholder}
      triggerMuted={!selected}
      triggerIcon={selected?.icon}
      accessibleValue={selected ? selected.label : placeholder}
      isSelected={(o) => o.value === value}
      onPick={(o, close) => {
        onChange(o.value);
        close();
      }}
    />
  );
}

export function MultiDropdown({
  values,
  onChange,
  options,
  label,
  placeholder,
  disabled,
  className,
  id,
  searchThreshold = SEARCH_THRESHOLD,
}: BaseProps & {
  /** ⚠️ An EMPTY array means "no filter", not "nothing matches". An untouched
   *  control must never hide rows. */
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useT();
  const picked = options.filter((o) => values.includes(o.value));

  const triggerText =
    picked.length === 0
      ? placeholder
      : picked.length === 1
        ? picked[0].label
        : t("common.selected", { count: picked.length });

  return (
    <DropdownShell
      id={id}
      label={label}
      disabled={disabled}
      className={className}
      options={options}
      searchThreshold={searchThreshold}
      triggerText={triggerText}
      triggerMuted={picked.length === 0}
      accessibleValue={triggerText}
      multi
      isSelected={(o) => values.includes(o.value)}
      // ⚠️ The menu stays OPEN on pick — picking three filters should cost
      // three clicks, not three open-pick-reopen cycles.
      onPick={(o) => {
        onChange(
          values.includes(o.value)
            ? values.filter((v) => v !== o.value)
            : [...values, o.value]
        );
      }}
      footer={
        picked.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full rounded-md px-2 py-1.5 text-start text-xs text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {t("common.clearSelection")}
          </button>
        ) : null
      }
    />
  );
}

// --- shared shell ----------------------------------------------------------

function DropdownShell({
  options,
  label,
  triggerText,
  triggerMuted,
  triggerIcon,
  accessibleValue,
  isSelected,
  onPick,
  footer,
  multi = false,
  disabled,
  className,
  id,
  searchThreshold,
}: {
  options: DropdownOption[];
  label: string;
  triggerText: string;
  triggerMuted: boolean;
  triggerIcon?: ReactNode;
  accessibleValue: string;
  isSelected: (o: DropdownOption) => boolean;
  onPick: (o: DropdownOption, close: () => void) => void;
  footer?: ReactNode;
  multi?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  searchThreshold: number;
}) {
  const t = useT();
  const generatedId = useId();
  const listId = `${id ?? generatedId}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const { side, measure } = usePopoverSide(triggerRef);

  const showSearch = options.length >= searchThreshold;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  // ⚠️ Clamped DURING RENDER, not in an effect. An effect here would commit a
  // stale cursor for one frame and trips react-hooks/set-state-in-effect,
  // which is an ERROR in this project.
  const maxIndex = Math.max(0, filtered.length - 1);
  const safeCursor = Math.min(cursor, maxIndex);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    measure();
    // Both resets happen HERE rather than in an effect, for the same reason as
    // the clamp above.
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    if (showSearch) searchRef.current?.focus();

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !document.getElementById(listId)?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, showSearch, listId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, maxIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[safeCursor];
      if (option && !option.disabled) onPick(option, close);
    }
  };

  return (
    <div className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // The trigger's text is a VALUE; the label names the field.
        aria-label={`${label}: ${accessibleValue}`}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-bg px-3",
          "text-sm transition-[border-color] duration-[var(--dur-fast)]",
          "hover:border-line-strong focus-visible:border-brand",
          "disabled:cursor-not-allowed disabled:opacity-55",
          open && "border-brand"
        )}
      >
        {triggerIcon}
        <span
          className={cn(
            "flex-1 truncate text-start",
            triggerMuted ? "text-faint" : "text-ink"
          )}
        >
          {triggerText}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-[var(--dur-fast)]",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable={multi || undefined}
          aria-label={label}
          className={cn(
            "animate-pop-in absolute inset-x-0 rounded-lg border border-line bg-raised p-1",
            "shadow-[var(--shadow-3)]",
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
          style={{ zIndex: "var(--z-dropdown)" }}
        >
          {showSearch && (
            <div className="relative mb-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-2 my-auto size-3.5 text-faint"
              />
              <input
                ref={searchRef}
                data-no-ring
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                placeholder={t("common.search")}
                aria-label={t("common.search")}
                className="h-8 w-full rounded-md border border-line bg-bg ps-7 pe-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-faint">
                {t("common.noResults")}
              </p>
            ) : (
              filtered.map((option, index) => {
                const active = isSelected(option);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => onPick(option, close)}
                    onMouseEnter={() => setCursor(index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm",
                      "transition-colors duration-[var(--dur-fast)]",
                      index === safeCursor && "bg-surface",
                      active ? "text-ink" : "text-muted",
                      option.disabled && "pointer-events-none opacity-45"
                    )}
                  >
                    {/* ⚠️ The check reserves its slot with `invisible` rather
                        than mounting on select — otherwise picking an option
                        shoves the row's contents sideways. */}
                    <Check
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 text-brand",
                        !active && "invisible"
                      )}
                    />
                    {option.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && (
                        <span className="block truncate text-xs text-faint">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {option.count != null && (
                      <span className="tnum shrink-0 font-mono text-xs text-faint">
                        {option.count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {footer && <div className="mt-1 border-t border-line pt-1">{footer}</div>}
        </div>
      )}
    </div>
  );
}
