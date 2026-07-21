"use client";

import { Archive, ArchiveRestore, Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import {
  archiveMaterial,
  createMaterial,
  updateMachineRate,
  updateMaterial,
} from "@/lib/actions/creative";
import { useI18n } from "@/lib/i18n/client";
import { toMajor } from "@/lib/money";
import type { Material, MaterialKind } from "@/lib/types";
import { MATERIAL_KINDS } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn, formatMinor } from "@/lib/utils";

const KIND_KEY: Record<MaterialKind, string> = {
  filament: "creative.filament",
  resin: "creative.resin",
  other: "creative.other",
};

/**
 * The two inputs to computed product cost.
 *
 * ⚠️ Changing either silently re-costs EVERY product — that is the intended
 * behaviour (cost is computed at read time, never stored), and it is why the
 * actions revalidate the Creative pages too.
 */
export function CostingForm({
  materials: initial,
  machineRateMinor,
  supplies = [],
}: {
  materials: Material[];
  machineRateMinor: number;
  /** Stocked supplies a material can be linked to, so printing deducts. */
  supplies?: { id: string; name: string; unit: string }[];
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();

  const [materials, setMaterials] = useState(initial);
  const [rate, setRate] = useState<number | null>(toMajor(machineRateMinor));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<MaterialKind>("filament");
  const [newCost, setNewCost] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState<number | null>(null);

  // Server truth adopted during render, never in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setMaterials(initial);
  }

  const rateDirty = (rate ?? 0) !== toMajor(machineRateMinor);

  const saveRate = () => {
    void run(() => updateMachineRate(rate ?? 0), {
      successMessage: t("creative.saved"),
      errorMessage: t("creative.saveFailed"),
    });
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setNewCost(null);
    setAdding(false);
    await run(
      () => createMaterial({ name, kind: newKind, costPerKg: newCost ?? 0 }),
      {
        onSuccess: (created) => setMaterials((list) => [...list, created]),
        errorMessage: t("creative.saveFailed"),
      }
    );
  };

  const saveEdit = async (material: Material) => {
    const name = editName.trim();
    const cost = editCost ?? 0;
    setEditingId(null);
    if (!name) return;
    const previous = materials;
    await run(() => updateMaterial(material.id, { name, costPerKg: cost }), {
      optimistic: () =>
        setMaterials((list) =>
          list.map((m) =>
            m.id === material.id
              ? { ...m, name, cost_per_kg_minor: Math.round(cost * 100) }
              : m
          )
        ),
      rollback: () => setMaterials(previous),
      errorMessage: t("creative.saveFailed"),
    });
  };

  /** Link (or unlink) a material to the supply it physically IS. */
  const linkSupply = async (material: Material, supplyId: string | null) => {
    const previous = materials;
    await run(
      () =>
        updateMaterial(material.id, {
          name: material.name,
          costPerKg: toMajor(material.cost_per_kg_minor),
          supplyId,
        }),
      {
        optimistic: () =>
          setMaterials((list) =>
            list.map((m) =>
              m.id === material.id ? { ...m, supply_id: supplyId } : m
            )
          ),
        rollback: () => setMaterials(previous),
        errorMessage: t("creative.saveFailed"),
      }
    );
  };

  const toggleArchive = async (material: Material) => {
    const archived = !material.archived_at;
    const previous = materials;
    await run(() => archiveMaterial(material.id, archived), {
      optimistic: () =>
        setMaterials((list) =>
          list.map((m) =>
            m.id === material.id
              ? { ...m, archived_at: archived ? new Date().toISOString() : null }
              : m
          )
        ),
      rollback: () => setMaterials(previous),
      errorMessage: t("creative.saveFailed"),
    });
  };

  return (
    <Panel title={t("creative.costing")} description={t("creative.costingSubtitle")}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              {t("creative.machineHourRate")}
            </label>
            <MoneyInput value={rate} onChange={setRate} min={0} />
            <p className="mt-1 text-xs text-faint">
              {t("creative.machineHourRateHint")}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={saveRate}
            loading={pending}
            disabled={!rateDirty}
          >
            {t("common.save")}
          </Button>
        </div>

        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">
              {t("creative.materials")}
            </span>
            <Button
              size="sm"
              onClick={() => setAdding(true)}
              icon={<Plus aria-hidden className="size-3.5" />}
            >
              {t("common.add")}
            </Button>
          </div>

          {adding && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
              <TextInput
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("creative.materialNamePlaceholder")}
                aria-label={t("creative.materialName")}
                autoFocus
                className="min-w-32 flex-1"
              />
              <Dropdown
                value={newKind}
                onChange={(v) => setNewKind(v as MaterialKind)}
                options={MATERIAL_KINDS.map((k) => ({
                  value: k,
                  label: t(KIND_KEY[k] as never),
                }))}
                label={t("creative.material")}
                placeholder={t("creative.filament")}
                className="w-32"
              />
              <MoneyInput
                value={newCost}
                onChange={setNewCost}
                min={0}
                className="w-36"
              />
              <Button variant="primary" size="sm" onClick={add} loading={pending}>
                {t("common.add")}
              </Button>
              <Button size="sm" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          )}

          {materials.length === 0 && !adding ? (
            <EmptyState
              title={t("creative.noMaterials")}
              description={t("creative.noMaterialsHint")}
            />
          ) : (
            <ul className="rounded-lg border border-line">
              {materials.map((material) => (
                <li
                  key={material.id}
                  className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
                >
                  {editingId === material.id ? (
                    <>
                      <TextInput
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-w-24 flex-1"
                        aria-label={t("creative.materialName")}
                        autoFocus
                      />
                      <MoneyInput
                        value={editCost}
                        onChange={setEditCost}
                        min={0}
                        className="w-36"
                      />
                      <IconButton
                        onClick={() => saveEdit(material)}
                        label={t("common.save")}
                      >
                        <Check aria-hidden className="size-3.5" />
                      </IconButton>
                      <IconButton
                        onClick={() => setEditingId(null)}
                        label={t("common.cancel")}
                      >
                        <X aria-hidden className="size-3.5" />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          material.archived_at ? "text-faint" : "text-ink"
                        )}
                      >
                        {material.name}
                      </span>
                      <Badge>{t(KIND_KEY[material.kind] as never)}</Badge>
                      <span className="tnum shrink-0 text-xs text-muted">
                        {formatMinor(material.cost_per_kg_minor)}/kg
                      </span>
                      {/* The stock link, made visible: if it's absent, printing
                          deducts nothing, and that should never be a surprise. */}
                      {supplies.length > 0 && (
                        <Dropdown
                          value={material.supply_id}
                          onChange={(v) => linkSupply(material, v || null)}
                          options={[
                            { value: "", label: t("creative.notStocked") },
                            ...supplies.map((s) => ({ value: s.id, label: s.name })),
                          ]}
                          label={t("creative.linkedSupply")}
                          placeholder={t("creative.notStocked")}
                          className="w-36 shrink-0"
                        />
                      )}
                      {material.archived_at && (
                        <Badge>{t("creative.archivedStatus")}</Badge>
                      )}
                      <IconButton
                        onClick={() => {
                          setEditingId(material.id);
                          setEditName(material.name);
                          setEditCost(toMajor(material.cost_per_kg_minor));
                        }}
                        label={t("common.edit")}
                      >
                        <Pencil aria-hidden className="size-3.5" />
                      </IconButton>
                      <IconButton
                        onClick={() => toggleArchive(material)}
                        label={
                          material.archived_at
                            ? t("finance.unarchive")
                            : t("finance.archive")
                        }
                      >
                        {material.archived_at ? (
                          <ArchiveRestore aria-hidden className="size-3.5" />
                        ) : (
                          <Archive aria-hidden className="size-3.5" />
                        )}
                      </IconButton>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-xs text-faint">
            {t("creative.materialsArchivedHint")}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-1.5 text-faint transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
