"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useT } from "@/lib/i18n/client";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn } from "@/lib/utils";
import { vocabSlug } from "@/lib/vocab";

/**
 * "Type to create, which also acts as a search."
 *
 * ⚠️ WHY THIS IS NOT `Dropdown` WITH A FLAG. A Dropdown's search box FILTERS a
 * closed set — typing something absent yields "no results", a dead end. Here
 * the typed text is itself the primary affordance: it always offers to become
 * a new word. Bolting that onto Dropdown would mean its search input sometimes
 * being a filter and sometimes being a value, which is exactly the kind of
 * control that behaves differently than it looks.
 *
 * The popover/keyboard/a11y shape deliberately mirrors `dropdown.tsx` so the
 * two feel like one control family — including the render-time cursor clamp,
 * because `react-hooks/set-state-in-effect` is an ERROR in this project.
 *
 * ⚠️ The parent owns creation. `onCreate` is async and returns the label that
 * was actually stored — which may differ in spelling from what was typed, if
 * the word already existed. Trusting the typed text instead would write
 * "keychain" onto a product while the registry says "Keychain".
 */

export type ComboOption = {
  /** The stored value — for vocabularies, the label itself. */
  value: string;
  label: string;
  hint?: string;
  count?: number;
};

type BaseProps = {
  options: ComboOption[];
  /** The trigger shows a VALUE, so the control needs its own name. */
  label: string;
  placeholder: string;
  /** Returns the stored label, or null if creation failed. */
  onCreate: (label: string) => Promise<string | null>;
  disabled?: boolean;
  className?: string;
  id?: string;
};

// --- single select ---------------------------------------------------------

export function ComboCreate({
  value,
  onChange,
  options,
  label,
  placeholder,
  onCreate,
  disabled,
  className,
  id,
}: BaseProps & {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useT();

  return (
    <ComboShell
      id={id}
      label={label}
      disabled={disabled}
      className={className}
      options={options}
      onCreate={onCreate}
      triggerText={value || placeholder}
      triggerMuted={!value}
      isSelected={(o) => o.value === value}
      onPick={(option, close) => {
        // Picking the current value again clears it — the only way to unset a
        // single-select without a separate clear button eating trigger width.
        onChange(option.value === value ? null : option.value);
        close();
      }}
      footer={
        value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-full rounded-md px-2 py-1.5 text-start text-xs text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            {t("common.clear")}
          </button>
        ) : null
      }
    />
  );
}

// --- multi select ----------------------------------------------------------

export function MultiComboCreate({
  values,
  onChange,
  options,
  label,
  placeholder,
  onCreate,
  disabled,
  className,
  id,
}: BaseProps & {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useT();

  const toggle = (next: string) => {
    // Compare on the SLUG, not the raw string: a value already on the record
    // may differ in spelling from the registry's label (older data, or a word
    // renamed since). Matching on text alone would add a near-duplicate.
    const slug = vocabSlug(next);
    const existing = values.find((v) => vocabSlug(v) === slug);
    onChange(
      existing
        ? values.filter((v) => v !== existing)
        : [...values, next]
    );
  };

  return (
    <>
      <ComboShell
        id={id}
        label={label}
        disabled={disabled}
        className={className}
        options={options}
        onCreate={onCreate}
        triggerText={
          values.length === 0
            ? placeholder
            : t("common.selected", { count: values.length })
        }
        triggerMuted={values.length === 0}
        isSelected={(o) =>
          values.some((v) => vocabSlug(v) === vocabSlug(o.value))
        }
        // ⚠️ Stays OPEN on pick — tagging someone with four tags should cost
        // four clicks, not four open-pick-reopen cycles. Same rule as
        // MultiDropdown.
        onPick={(option) => toggle(option.value)}
        onCreated={(created) => {
          if (!values.some((v) => vocabSlug(v) === vocabSlug(created))) {
            onChange([...values, created]);
          }
        }}
        footer={
          values.length > 0 ? (
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

      {/* Chips live OUTSIDE the trigger. Inside, a growing set of tags would
          make the control change height as you type, shoving the rest of the
          form down. */}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink">
                {tag}
                <button
                  type="button"
                  onClick={() => toggle(tag)}
                  aria-label={`${t("common.clear")}: ${tag}`}
                  className="rounded-full p-0.5 text-faint transition-colors hover:text-danger"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// --- shared shell ----------------------------------------------------------

function ComboShell({
  options,
  label,
  triggerText,
  triggerMuted,
  isSelected,
  onPick,
  onCreate,
  onCreated,
  footer,
  disabled,
  className,
  id,
}: {
  options: ComboOption[];
  label: string;
  triggerText: string;
  triggerMuted: boolean;
  isSelected: (o: ComboOption) => boolean;
  onPick: (o: ComboOption, close: () => void) => void;
  onCreate: (label: string) => Promise<string | null>;
  onCreated?: (label: string) => void;
  footer?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const t = useT();
  const generatedId = useId();
  const listId = `${id ?? generatedId}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const { side, measure } = usePopoverSide(triggerRef);

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    if (!trimmed) return options;
    const q = trimmed.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false)
    );
  }, [options, trimmed]);

  /** Offer creation unless the typed word already exists, in any spelling. */
  const canCreate =
    trimmed.length > 0 &&
    !options.some((o) => vocabSlug(o.value) === vocabSlug(trimmed));

  // The create row sits at index 0 when present, so the keyboard cursor spans
  // it and the filtered list as one sequence.
  const rowCount = filtered.length + (canCreate ? 1 : 0);
  // ⚠️ Clamped DURING RENDER, not in an effect — same rule as dropdown.tsx.
  const maxIndex = Math.max(0, rowCount - 1);
  const safeCursor = Math.min(cursor, maxIndex);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    measure();
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

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
  }, [open, listId]);

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    // The action returns the label that was actually STORED — which differs
    // from what was typed when the word already existed in another spelling.
    const stored = await onCreate(trimmed);
    setCreating(false);
    if (!stored) return;

    onCreated?.(stored);
    if (!onCreated) {
      onPick({ value: stored, label: stored }, close);
      return;
    }
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  };

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
    } else if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCursor(maxIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate && safeCursor === 0) {
        void create();
        return;
      }
      const option = filtered[canCreate ? safeCursor - 1 : safeCursor];
      if (option) onPick(option, close);
    } else if (e.key === "Tab") {
      // Don't leave the popover open and orphaned behind the next field.
      close();
    }
  };

  // Row 0 is the create affordance when canCreate; filtered rows follow. One id
  // scheme over the whole cursor space, so aria-activedescendant always
  // resolves to the visibly-highlighted row.
  const rowId = (cursor: number) => `${listId}-row-${cursor}`;

  // Keep the highlighted row visible in the scroll area — see Dropdown.
  useEffect(() => {
    if (!open) return;
    document.getElementById(rowId(safeCursor))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCursor, open]);

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
        aria-label={`${label}: ${triggerText}`}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-bg px-3",
          "text-sm transition-[border-color] duration-[var(--dur-fast)]",
          "hover:border-line-strong focus-visible:border-brand",
          "disabled:cursor-not-allowed disabled:opacity-55",
          open && "border-brand"
        )}
      >
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
          aria-label={label}
          className={cn(
            "animate-pop-in absolute inset-x-0 rounded-lg border border-line bg-raised p-1",
            "shadow-[var(--shadow-3)]",
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
          style={{ zIndex: "var(--z-dropdown)" }}
        >
          {/* Always present — this input IS the create affordance, so hiding
              it below a threshold (as Dropdown does) would remove the feature. */}
          <div className="mb-1">
            <input
              ref={inputRef}
              data-no-ring
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={rowId(safeCursor)}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              placeholder={t("vocab.typeToCreate")}
              aria-label={t("vocab.typeToCreate")}
              className="h-8 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {canCreate && (
              <button
                type="button"
                id={rowId(0)}
                role="option"
                aria-selected={safeCursor === 0}
                disabled={creating}
                onClick={() => void create()}
                onMouseEnter={() => setCursor(0)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm",
                  "transition-colors duration-[var(--dur-fast)]",
                  safeCursor === 0 && "bg-surface",
                  creating && "opacity-55"
                )}
              >
                <Plus aria-hidden className="size-3.5 shrink-0 text-brand-text" />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {t("vocab.createLabel", { label: trimmed })}
                </span>
              </button>
            )}

            {filtered.length === 0 && !canCreate ? (
              <p className="px-2 py-3 text-center text-xs text-faint">
                {t("common.noResults")}
              </p>
            ) : (
              filtered.map((option, index) => {
                const row = canCreate ? index + 1 : index;
                const active = isSelected(option);
                return (
                  <button
                    key={option.value}
                    id={rowId(row)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onPick(option, close)}
                    onMouseEnter={() => setCursor(row)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm",
                      "transition-colors duration-[var(--dur-fast)]",
                      row === safeCursor && "bg-surface",
                      active ? "text-ink" : "text-muted"
                    )}
                  >
                    {/* Reserves its slot with `invisible` so picking doesn't
                        shove the row's contents sideways. */}
                    <Check
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 text-brand-text",
                        !active && "invisible"
                      )}
                    />
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
