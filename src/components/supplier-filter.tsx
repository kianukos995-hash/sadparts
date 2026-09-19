"use client";

import Link from "next/link";
import { SUPPLIER_PRESETS, isSupplierConnected, logoForSupplier } from "@/lib/supplier-presets";
import type { Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SupplierLogo } from "@/components/supplier-logo";
import { SearchPick } from "@/components/search-pick";
import { Label } from "@/components/ui/label";

export function SupplierFilter({
  suppliers,
  value,
  onChange,
  showCatalog = true,
  canCreate = true,
}: {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
  showCatalog?: boolean;
  canCreate?: boolean;
}) {
  const connected = suppliers.filter(isSupplierConnected);
  const current = value === "all" || !value ? "" : value;

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Поставщик</Label>
      <SearchPick
        value={current}
        onChange={(id) => onChange(id || "all")}
        placeholder="Найти поставщика…"
        emptyLabel="Все поставщики"
        options={suppliers.map((item) => ({
          id: item.id,
          label: `${item.name}${isSupplierConnected(item) ? "" : " · не подключён"}`,
          logo: logoForSupplier(item) || undefined,
        }))}
      />
      {showCatalog ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              !current ? "border-amber-400 bg-amber-50 font-medium" : "hover:bg-muted",
            )}
            onClick={() => onChange("all")}
          >
            Все
          </button>
          {suppliers.map((supplier) => {
            const on = supplier.id === current;
            return (
              <button
                key={supplier.id}
                type="button"
                title={supplier.name}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs",
                  on ? "border-amber-400 bg-amber-50 font-medium" : "hover:bg-muted",
                  !isSupplierConnected(supplier) && "opacity-60",
                )}
                onClick={() => onChange(on ? "all" : supplier.id)}
              >
                <SupplierLogo supplier={supplier} size="sm" className="size-6 rounded-full" />
                <span className="max-w-28 truncate">{supplier.name}</span>
              </button>
            );
          })}
          {canCreate
            ? SUPPLIER_PRESETS.filter(
            (preset) =>
              !suppliers.some(
                (item) => item.presetId === preset.id || item.code === preset.code || item.name === preset.name,
              ),
          ).map((preset) => (
            <Link
              key={preset.id}
              href={`/settings?tab=suppliers&preset=${preset.id}`}
              title={`${preset.name} — не подключён`}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed py-0.5 pr-2.5 pl-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <SupplierLogo src={preset.logoUrl} name={preset.name} size="sm" className="size-6 rounded-full" />
              <span className="max-w-28 truncate">{preset.name}</span>
            </Link>
          ))
            : SUPPLIER_PRESETS.filter(
                (preset) =>
                  !suppliers.some(
                    (item) => item.presetId === preset.id || item.code === preset.code || item.name === preset.name,
                  ),
              )
                .slice(0, 24)
                .map((preset) => (
                  <Link
                    key={preset.id}
                    href={`/settings?tab=suppliers&requestPreset=${preset.id}`}
                    title={`${preset.name} — запросить добавление`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed py-0.5 pr-2.5 pl-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <SupplierLogo src={preset.logoUrl} name={preset.name} size="sm" className="size-6 rounded-full" />
                    <span className="max-w-28 truncate">{preset.name}</span>
                  </Link>
                ))}
          {connected.length === 0 && suppliers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Поставщиков пока нет — добавьте в Настройках.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
