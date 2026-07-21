"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn, todayInIstanbul } from "@/lib/utils";

/**
 * Custom date control — never `<input type="date">`, whose UI and parsing
 * differ wildly between browsers and cannot be themed.
 *
 * Values are plain `YYYY-MM-DD` strings throughout, never `Date` objects, so
 * no time zone can attach itself to a date that has no time.
 *
 * ⚠️ The month grid is Gregorian in both locales. Farsi renders Persian
 * DIGITS and month names via Intl, but the calendar system stays Gregorian
 * because every date in this system comes from a Gregorian business record
 * (invoices, carrier dates, expo schedules). Switching to Jalali would mean
 * translating in both directions on every read and write.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  clearable = true,
  className,
  min,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  min?: string;
}) {
  const { locale, t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // 280 is the panel's own `w-[17.5rem]` — it must stay in step with the
  // class below, or the measurement is checking the wrong box.
  const { side, align, measure } = usePopoverSide(triggerRef, 340, 280);

  const today = todayInIstanbul();
  const [viewMonth, setViewMonth] = useState(() => (value ?? today).slice(0, 7));

  /** Which grid the popover is showing: days, months, or a page of years. */
  const [picking, setPicking] = useState<"day" | "month" | "year">("day");
  /** First year of the visible 12-year page. */
  const [yearPage, setYearPage] = useState(
    () => yearPageStart(Number((value ?? today).slice(0, 4)))
  );

  const intlLocale = locale === "fa" ? "fa-IR-u-ca-gregory" : "en-GB";

  const monthLabel = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    return new Intl.DateTimeFormat(intlLocale, {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
  }, [viewMonth, intlLocale]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
    // Week starts Monday — the working week in both Türkiye and Iran begins
    // before the weekend day, and Monday-first is what a business calendar
    // reads as here.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [intlLocale]);

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = value
    ? new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : null;

  const shiftMonth = (delta: number) => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("common.chooseDate")}${display ? `: ${display}` : ""}`}
        onClick={() => {
          if (!open) {
            measure();
            setViewMonth((value ?? today).slice(0, 7));
            // Reset HERE rather than in an effect — an effect would render the
            // stale grid for one frame, and `react-hooks/set-state-in-effect`
            // is an error in this project.
            setPicking("day");
            setYearPage(yearPageStart(Number((value ?? today).slice(0, 4))));
          }
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm",
          "transition-[border-color] duration-[var(--dur-fast)]",
          "hover:border-line-strong focus-visible:border-brand",
          "disabled:cursor-not-allowed disabled:opacity-55",
          open && "border-brand"
        )}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-faint" />
        <span className={cn("flex-1 truncate text-start", !display && "text-faint")}>
          {display ?? placeholder ?? t("common.chooseDate")}
        </span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t("common.clear")}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            className="rounded p-0.5 text-faint transition-colors hover:text-ink"
          >
            <X aria-hidden className="size-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={t("common.chooseDate")}
          className={cn(
            "animate-pop-in absolute w-[17.5rem] rounded-lg border border-line bg-raised p-3 shadow-[var(--shadow-3)]",
            // ⚠️ Logical, not left/right — this mirrors correctly in Farsi.
            // `end-0` anchors the panel's END edge to the trigger's, so a
            // 280px panel hanging off a 144px trigger grows back over the page
            // instead of off the screen.
            align === "start" ? "start-0" : "end-0",
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
          style={{ zIndex: "var(--z-dropdown)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <NavButton
              onClick={() => shiftMonth(-1)}
              label={t("common.previousMonth")}
              disabled={picking !== "day"}
            >
              {/* Chevrons are physical direction, so they mirror in RTL. */}
              <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
            </NavButton>

            {/* ⚠️ THE MONTH LABEL IS A BUTTON, not a caption. Stepping one
                month at a time is fine for "next Tuesday" and absurd for a
                birthday: reaching 1990 from today is ~430 clicks, which is
                what made the client birthday field unusable. */}
            <button
              type="button"
              onClick={() =>
                setPicking((p) => (p === "day" ? "month" : p === "month" ? "year" : "day"))
              }
              aria-expanded={picking !== "day"}
              className="rounded-md px-2 py-1 text-sm font-medium text-ink transition-colors hover:bg-surface"
            >
              {picking === "year" ? `${yearPage} – ${yearPage + 11}` : monthLabel}
            </button>

            <NavButton
              onClick={() => shiftMonth(1)}
              label={t("common.nextMonth")}
              disabled={picking !== "day"}
            >
              <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
            </NavButton>
          </div>

          {picking === "year" && (
            <YearGrid
              page={yearPage}
              selected={Number(viewMonth.slice(0, 4))}
              locale={locale}
              onPage={setYearPage}
              onPick={(y) => {
                setViewMonth(`${y}-${viewMonth.slice(5, 7)}`);
                setPicking("month");
              }}
            />
          )}

          {picking === "month" && (
            <MonthGrid
              selected={Number(viewMonth.slice(5, 7)) - 1}
              intlLocale={intlLocale}
              onPick={(m) => {
                setViewMonth(
                  `${viewMonth.slice(0, 4)}-${`${m + 1}`.padStart(2, "0")}`
                );
                setPicking("day");
              }}
            />
          )}

          <div className={cn("grid grid-cols-7 gap-0.5", picking !== "day" && "hidden")}>
            {weekdays.map((w, i) => (
              <div
                key={i}
                className="grid h-7 place-items-center text-2xs font-medium text-faint"
              >
                {w}
              </div>
            ))}
            {days.map(({ date, inMonth }) => {
              const isToday = date === today;
              const isSelected = date === value;
              const isDisabled = min ? date < min : false;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "tnum grid h-8 place-items-center rounded-md text-xs transition-colors duration-[var(--dur-fast)]",
                    inMonth ? "text-ink" : "text-faint/60",
                    !isSelected && "hover:bg-surface",
                    isSelected && "bg-brand font-medium text-brand-ink",
                    isToday && !isSelected && "ring-1 ring-brand-line",
                    isDisabled && "pointer-events-none opacity-30"
                  )}
                >
                  {new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-GB").format(
                    Number(date.slice(8, 10))
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
            >
              {t("common.today")}
            </button>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
              >
                {t("common.clear")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Years are paged twelve at a time — a 4×3 grid on the calendar's own width. */
const YEAR_PAGE_SIZE = 12;

function yearPageStart(year: number): number {
  return Math.floor(year / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE;
}

function YearGrid({
  page,
  selected,
  locale,
  onPage,
  onPick,
}: {
  page: number;
  selected: number;
  locale: string;
  onPage: (start: number) => void;
  onPick: (year: number) => void;
}) {
  const fmt = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    useGrouping: false,
  });
  const years = Array.from({ length: YEAR_PAGE_SIZE }, (_, i) => page + i);

  return (
    <div>
      <div className="grid grid-cols-4 gap-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onPick(y)}
            aria-current={y === selected ? "date" : undefined}
            className={cn(
              "tnum grid h-9 place-items-center rounded-md text-xs transition-colors duration-[var(--dur-fast)]",
              y === selected
                ? "bg-brand font-medium text-brand-ink"
                : "text-ink hover:bg-surface"
            )}
          >
            {fmt.format(y)}
          </button>
        ))}
      </div>
      {/* Paging by twelve keeps a birthday two clicks away rather than thirty. */}
      <div className="mt-1 flex justify-between">
        <button
          type="button"
          onClick={() => onPage(page - YEAR_PAGE_SIZE)}
          className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
        >
          {fmt.format(page - YEAR_PAGE_SIZE)}
        </button>
        <button
          type="button"
          onClick={() => onPage(page + YEAR_PAGE_SIZE)}
          className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
        >
          {fmt.format(page + YEAR_PAGE_SIZE)}
        </button>
      </div>
    </div>
  );
}

function MonthGrid({
  selected,
  intlLocale,
  onPick,
}: {
  selected: number;
  intlLocale: string;
  onPick: (month: number) => void;
}) {
  const fmt = new Intl.DateTimeFormat(intlLocale, { month: "short" });
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 12 }, (_, m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          aria-current={m === selected ? "date" : undefined}
          className={cn(
            "grid h-9 place-items-center rounded-md text-xs transition-colors duration-[var(--dur-fast)]",
            m === selected
              ? "bg-brand font-medium text-brand-ink"
              : "text-ink hover:bg-surface"
          )}
        >
          {fmt.format(new Date(2024, m, 1))}
        </button>
      ))}
    </div>
  );
}

/** Six weeks of YYYY-MM-DD covering the month, Monday-first. */
function buildMonthGrid(month: string): { date: string; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay: 0=Sun. Shift so Monday is column 0.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: { date: string; inMonth: boolean }[] = [];
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - lead);

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, inMonth: iso.slice(0, 7) === month });
  }
  return cells;
}
