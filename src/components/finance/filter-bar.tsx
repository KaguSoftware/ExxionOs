"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown, MultiDropdown } from "@/components/ui/dropdown";
import { TextInput } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import type { Category, Direction } from "@/lib/types";
import type { FinanceFilters } from "@/lib/use-finance-filters";

export function FinanceFilterBar({
  filters,
  patch,
  reset,
  dirty,
  categories,
}: {
  filters: FinanceFilters;
  patch: (next: Partial<FinanceFilters>) => void;
  reset: () => void;
  dirty: boolean;
  categories: Category[];
}) {
  const { t } = useI18n();
  const searchId = useId();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <TextInput
        id={searchId}
        value={filters.query}
        onChange={(e) => patch({ query: e.target.value })}
        placeholder={t("finance.searchPlaceholder")}
        aria-label={t("finance.searchPlaceholder")}
        leading={<Search aria-hidden className="size-3.5" />}
        className="min-w-48 flex-1"
      />

      <DatePicker
        value={filters.from}
        onChange={(v) => patch({ from: v ?? filters.from })}
        placeholder={t("finance.from")}
        clearable={false}
        className="w-36 shrink-0"
      />
      <DatePicker
        value={filters.to}
        onChange={(v) => patch({ to: v ?? filters.to })}
        placeholder={t("finance.to")}
        clearable={false}
        className="w-36 shrink-0"
      />

      <Dropdown
        value={filters.direction}
        onChange={(v) => patch({ direction: (v as Direction) || null })}
        options={[
          { value: "", label: t("finance.allDirections") },
          { value: "in", label: t("finance.money_in") },
          { value: "out", label: t("finance.money_out") },
        ]}
        label={t("finance.direction")}
        placeholder={t("finance.allDirections")}
        className="w-40 shrink-0"
      />

      <MultiDropdown
        values={filters.categories}
        onChange={(v) => patch({ categories: v })}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        label={t("finance.category")}
        placeholder={t("finance.allCategories")}
        className="w-44 shrink-0"
      />

      {/* Only rendered when there is something to clear — a permanently
          disabled button is furniture. It sits last so its appearance can't
          reflow the controls before it. */}
      {dirty && (
        <Button
          size="sm"
          onClick={reset}
          icon={<X aria-hidden className="size-3.5" />}
        >
          {t("finance.clearFilters")}
        </Button>
      )}
    </div>
  );
}
