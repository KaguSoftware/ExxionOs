"use client";

import { MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type MenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Renders in `--danger` and sits last by convention. */
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * The overflow menu — a list of ACTIONS, not a value picker.
 *
 * ⚠️ WHY THIS IS NOT `Dropdown`. `Dropdown` picks a value from a set and shows
 * the current one; a menu fires a verb and has no state. More practically,
 * `Dropdown`'s popover is `absolute inset-x-0` inside its own wrapper at
 * `--z-dropdown` (40), which makes it unusable in the two places this component
 * exists for: inside a card with `overflow-hidden` (it gets clipped) and inside
 * an overlay at `--z-overlay` (60) (it renders underneath).
 *
 * ⚠️ SO THIS PORTALS TO `document.body` AND POSITIONS ITSELF `fixed` from the
 * trigger's rect, at `--z-modal` (70). Same reasoning as `CreateOverlay`:
 * `position: fixed` only resolves against the viewport when no ancestor has a
 * transform, and this app animates `transform` on nearly every page wrapper.
 * Escaping the subtree is the only version that cannot regress.
 *
 * ⚠️ The open/focus effect keys on `[open]` alone and reads its callbacks from
 * a ref — the same discipline as `CreateOverlay`, and for the same reason: a
 * dep on a caller's inline handler re-runs the effect on every parent render
 * and steals focus.
 */
export function Menu({
  items,
  label,
  trigger,
  align = "end",
  className,
}: {
  items: MenuItem[];
  /** Accessible name for the trigger — it is an icon button by default. */
  label: string;
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  /** Roving focus index for keyboard users. -1 = nothing focused yet. */
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Latest items, so the key handler never lists them in its deps.
  const latest = useRef({ items, active });
  useEffect(() => {
    latest.current = { items, active };
  });

  const close = (restoreFocus = true) => {
    setOpen(false);
    setActive(-1);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const openMenu = () => {
    // Measured at open, not in an effect — the rect is only meaningful once,
    // and reading it here keeps the first paint correct.
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setActive(-1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      const { items: list, active: index } = latest.current;
      const enabled = list.filter((i) => !i.disabled);
      if (enabled.length === 0) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      // Tab closes rather than trapping — a menu is transient, and trapping
      // focus in three buttons is more machinery than the surface needs.
      if (e.key === "Tab") {
        close(false);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next =
          index < 0
            ? delta > 0
              ? 0
              : list.length - 1
            : (index + delta + list.length) % list.length;
        setActive(next);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActive(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setActive(list.length - 1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const item = list[index];
        if (!item || item.disabled) return;
        e.preventDefault();
        close();
        item.onSelect();
      }
    };

    // Any scroll invalidates the measured rect, so close rather than float
    // detached from the trigger. Capture phase catches scrolls in any ancestor.
    const onScroll = () => close(false);

    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // ⚠️ `open` ONLY — see the docstring.
  }, [open]);

  // Move DOM focus to follow the roving index.
  useEffect(() => {
    if (!open || active < 0) return;
    const nodes = listRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']");
    nodes?.[active]?.focus();
  }, [open, active]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          "grid size-8 place-items-center rounded-lg border border-line bg-surface text-muted",
          "transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:text-ink",
          open && "border-line-strong text-ink",
          className
        )}
      >
        {trigger ?? <MoreHorizontal aria-hidden className="size-4" />}
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* An invisible full-screen catcher, so an outside click closes the
                menu without every consumer wiring up a document listener. */}
            <div
              className="fixed inset-0"
              style={{ zIndex: "var(--z-modal)" }}
              onClick={() => close()}
            />
            <div
              ref={listRef}
              id={menuId}
              role="menu"
              aria-label={label}
              // Positioned in the INLINE axis so it mirrors in Farsi without a
              // physical-direction class. `align="end"` pins the menu's end
              // edge to the trigger's end edge.
              style={{
                zIndex: "var(--z-modal)",
                top: `${rect.bottom + 6}px`,
                ...(align === "end"
                  ? {
                      insetInlineEnd: `${
                        document.documentElement.dir === "rtl"
                          ? rect.left
                          : window.innerWidth - rect.right
                      }px`,
                    }
                  : {
                      insetInlineStart: `${
                        document.documentElement.dir === "rtl"
                          ? window.innerWidth - rect.right
                          : rect.left
                      }px`,
                    }),
              }}
              className="animate-pop-in fixed min-w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  tabIndex={index === active ? 0 : -1}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm",
                    "transition-colors duration-[var(--dur-fast)]",
                    "disabled:pointer-events-none disabled:opacity-55",
                    item.destructive ? "text-danger" : "text-ink",
                    index === active && "bg-raised"
                  )}
                >
                  {item.icon && (
                    <span className="shrink-0 text-faint">{item.icon}</span>
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
