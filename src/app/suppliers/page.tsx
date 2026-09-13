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
import { SupplierFormDialog } from "@/components/supplier-form";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { AUTH_MODE_LABELS } from "@/lib/constants";
import { formatDateTime, formatDays, maskKey } from "@/lib/format";
import { buildSyncLog, syncSupplier } from "@/lib/sync";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  const { ready, suppliers, upsertSupplier, removeSupplier, replaceOffers } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function runSync(supplier: Supplier) {
    if (supplier.source !== "api") {
      toast.error("У этого поставщика нет API — загрузите файл");
      return;
    }
    setSyncingId(supplier.id);
    try {
      const result = await syncSupplier(supplier);
      await replaceOffers(supplier.id, result.offers, buildSyncLog(supplier, result, "api"));
      toast.success(`${supplier.name}: ${result.offers.length} позиций`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка синхронизации";
      await replaceOffers(supplier.id, [], buildSyncLog(supplier, { error: message }, "api"));
      toast.error(message);
    } finally {
      setSyncingId(null);
    }
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю поставщиков…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Поставщики</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            API-ключи, адреса прайсов и тип авторизации. Ключи маскируются в списке.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Добавить
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Поставщиков нет. Добавьте API или источник для загрузки файла.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="hidden md:table-cell">Источник</TableHead>
              <TableHead className="hidden lg:table-cell">Ключ</TableHead>
              <TableHead>Синхронизация</TableHead>
              <TableHead className="hidden md:table-cell">До Москвы</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell>
                  <Link href={`/suppliers/${supplier.id}`} className="font-medium hover:underline">
                    {supplier.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{supplier.code}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{supplier.source === "api" ? "API" : "Файл"}</Badge>
                    {supplier.source === "api" ? (
                      <Badge variant="outline">{AUTH_MODE_LABELS[supplier.authMode]}</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {supplier.source === "api" ? maskKey(supplier.apiKey) : "—"}
                </TableCell>
                <TableCell>
                  <p className="text-sm">{formatDateTime(supplier.lastSyncAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {supplier.lastSyncStatus === "error"
                      ? supplier.lastSyncError
                      : `${supplier.lastSyncCount ?? 0} позиций`}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="text-sm">{formatDays(supplier.deliveryDaysMoscow)}</p>
                  <p className="max-w-48 truncate text-xs text-muted-foreground">
                    {supplier.deliveryNote || "—"}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingId === supplier.id || supplier.source !== "api"}
                      onClick={() => void runSync(supplier)}
                    >
                      <RefreshCw className={syncingId === supplier.id ? "animate-spin" : ""} />
                      Синхр.
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Удалить «${supplier.name}» и его прайс?`)) {
                          removeSupplier(supplier.id);
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SupplierFormDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(supplier) => {
          upsertSupplier(supplier).then(() => toast.success("Поставщик сохранён"));
        }}
      />
    </div>
  );
}
