"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceListUpload } from "@/components/price-list-upload";
import { SupplierFormDialog } from "@/components/supplier-form";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_MODE_LABELS } from "@/lib/constants";
import { formatDateTime, formatDays, maskKey } from "@/lib/format";
import { isApiSupplier, isFileSupplier } from "@/lib/money";
import { buildSyncLog, syncSupplier } from "@/lib/sync";
import type { Supplier, SupplierSource } from "@/lib/types";
import { canDeleteSupplier, canEditSupplier, isAdminOwnedSupplier } from "@/lib/suppliers-scope";

function keySummary(supplier: Supplier) {
  if (supplier.adapter === "rossko") {
    return `KEY1 ${maskKey(supplier.apiKey)} · KEY2 ${maskKey(supplier.apiKey2)}`;
  }
  if (supplier.source === "api") {
    const second = supplier.apiKey2.trim() ? ` · KEY2 ${maskKey(supplier.apiKey2)}` : "";
    return `${maskKey(supplier.apiKey)}${second}`;
  }
  const mapped = Object.values(supplier.columnMap ?? {}).filter(Boolean).length;
  return mapped ? `карта ${mapped} полей` : "файл";
}

function ownershipBadge(supplier: Supplier) {
  if (isAdminOwnedSupplier(supplier) || supplier.lockedByAdmin) {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-800">
        Админ · замок
      </Badge>
    );
  }
  return <Badge variant="secondary">Свой</Badge>;
}

const COPY: Record<
  "file" | "api",
  { title: string; hint: string; empty: string; add: string; source: SupplierSource }
> = {
  file: {
    title: "Поставщики через файлы",
    hint: "CSV, ZIP, XLSX и jsonl-каталоги на диске. Список: свои (редактируемые) и предложенные администратором (замок).",
    empty: "Файловых поставщиков нет. Добавьте свой источник или попросите администратора открыть доступ.",
    add: "Добавить из файла",
    source: "file",
  },
  api: {
    title: "Поставщики через API",
    hint: "Свои ключи и URL можно менять. Поставщики администратора только для чтения — ключи скрыты.",
    empty: "API-поставщиков нет. Добавьте свой ключ или дождитесь предложения администратора.",
    add: "Добавить API",
    source: "api",
  },
};

export function SuppliersBoard({ kind }: { kind: "file" | "api" }) {
  const { user } = useAuth();
  const {
    ready,
    error,
    refresh,
    suppliers,
    organizations,
    upsertSupplier,
    removeSupplier,
    replaceOffers,
    shareSupplier,
  } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const copy = COPY[kind];
  const list = suppliers.filter((supplier) =>
    kind === "file" ? isFileSupplier(supplier) : isApiSupplier(supplier),
  );
  const admin = user?.role === "admin";

  async function runSync(supplier: Supplier) {
    if (!canEditSupplier(supplier, user, organizations)) {
      toast.error("Поставщика закрепил администратор");
      return;
    }
    if (supplier.adapter === "rossko") {
      setSyncingId(supplier.id);
      try {
        const response = await fetch("/api/rossko", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", supplierId: supplier.id }),
        });
        const data = (await response.json()) as {
          error?: string;
          details?: { deliveries: { name: string }[] };
        };
        if (!response.ok) throw new Error(data.error || "Ключи Росско не приняты");
        toast.success(
          `KEY1/KEY2 работают. Доставка: ${(data.details?.deliveries ?? []).map((item) => item.name).join(", ") || "ок"}`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка Росско");
      } finally {
        setSyncingId(null);
      }
      return;
    }
    if (supplier.source !== "api") {
      toast.error("У этого поставщика нет API — нажмите «Добавить прайс» и выберите файл");
      return;
    }
    setSyncingId(supplier.id);
    try {
      const result = await syncSupplier(supplier);
      await replaceOffers(supplier.id, result.offers, buildSyncLog(supplier, result, "api"));
      toast.success(`${supplier.name}: ${result.offers.length} позиций`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка синхронизации";
      await replaceOffers(supplier.id, [], buildSyncLog(supplier, { error: message }, "api"));
      toast.error(message);
    } finally {
      setSyncingId(null);
    }
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю поставщиков…</p>;

  if (error) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-12 text-center">
        <p className="text-sm font-medium">Не загрузить поставщиков</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.hint}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {kind === "file" ? (
              <>
                API-коннекторы — в{" "}
                <Link href="/suppliers/api" className="underline hover:text-foreground">
                  поставщиках через API
                </Link>
                .
              </>
            ) : (
              <>
                Файлы и jsonl — в{" "}
                <Link href="/suppliers/files" className="underline hover:text-foreground">
                  поставщиках через файлы
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          {copy.add}
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="hidden md:table-cell">Источник</TableHead>
              <TableHead className="hidden lg:table-cell">Ключи</TableHead>
              <TableHead>Синхронизация</TableHead>
              <TableHead className="hidden md:table-cell">До Москвы</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((supplier) => {
              const editable = canEditSupplier(supplier, user, organizations);
              return (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <Link href={`/suppliers/${supplier.id}`} className="font-medium hover:underline">
                      {supplier.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <p className="text-xs text-muted-foreground">{supplier.code}</p>
                      {ownershipBadge(supplier)}
                    </div>
                    {admin && organizations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {organizations.map((org) => {
                          const shared = (supplier.sharedWithOrgIds ?? []).includes(org.id);
                          return (
                            <label key={org.id} className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={shared}
                                onChange={(event) => {
                                  void shareSupplier(supplier.id, org.id, event.target.checked)
                                    .then(() =>
                                      toast.success(
                                        event.target.checked
                                          ? `Открыто для «${org.name}»`
                                          : `Доступ «${org.name}» отозван`,
                                      ),
                                    )
                                    .catch((err: unknown) =>
                                      toast.error(err instanceof Error ? err.message : "Ошибка"),
                                    );
                                }}
                              />
                              {org.name}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{supplier.source === "api" ? "API" : "Файл"}</Badge>
                      {supplier.source === "api" ? (
                        <Badge variant="outline">{AUTH_MODE_LABELS[supplier.authMode]}</Badge>
                      ) : null}
                      {kind === "file" && isApiSupplier(supplier) ? (
                        <Badge variant="outline">есть API</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {editable ? keySummary(supplier) : "скрыты"}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{formatDateTime(supplier.lastSyncAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {supplier.lastSyncStatus === "error"
                        ? supplier.lastSyncError
                        : `${supplier.catalogCount ?? supplier.lastSyncCount ?? 0} позиций`}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm">{formatDays(supplier.deliveryDaysMoscow)}</p>
                    <p className="max-w-48 truncate text-xs text-muted-foreground">
                      {supplier.deliveryNote || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {editable ? <PriceListUpload supplier={supplier} /> : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !editable ||
                          syncingId === supplier.id ||
                          (supplier.source !== "api" && supplier.adapter !== "rossko")
                        }
                        onClick={() => void runSync(supplier)}
                      >
                        <RefreshCw className={syncingId === supplier.id ? "animate-spin" : ""} />
                        {supplier.adapter === "rossko" ? "Ключи" : "Синхр."}
                      </Button>
                      {canDeleteSupplier(supplier, user, organizations) ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm(`Удалить «${supplier.name}» и его прайс?`)) {
                              void removeSupplier(supplier.id);
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <SupplierFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultSource={copy.source}
        onSave={(supplier) => {
          void upsertSupplier(supplier).then(() => toast.success("Поставщик сохранён"));
        }}
      />
    </div>
  );
}
