"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyField } from "@/components/key-field";
import { PartsTable } from "@/components/parts-table";
import { SupplierFormDialog } from "@/components/supplier-form";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { AUTH_MODE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { fetchSupplierPayload, payloadToOffers, buildSyncLog, syncSupplier } from "@/lib/sync";
import { cn } from "@/lib/utils";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready, suppliers, offers, logs, upsertSupplier, replaceOffers } = useAvtoPrice();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"sync" | "test" | null>(null);

  const supplier = suppliers.find((item) => item.id === params.id);
  const supplierOffers = useMemo(
    () => offers.filter((offer) => offer.supplierId === params.id),
    [offers, params.id],
  );
  const supplierLogs = logs.filter((log) => log.supplierId === params.id).slice(0, 8);

  async function runSync() {
    if (!supplier) return;
    setBusy("sync");
    try {
      const result = await syncSupplier(supplier);
      await replaceOffers(supplier.id, result.offers, buildSyncLog(supplier, result, "api"));
      toast.success(`Импортировано ${result.offers.length} позиций`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка синхронизации";
      await replaceOffers(supplier.id, [], buildSyncLog(supplier, { error: message }, "api"));
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    if (!supplier) return;
    setBusy("test");
    try {
      const payload = await fetchSupplierPayload(supplier);
      const result = payloadToOffers(payload, supplier);
      toast.success(`Ответ получен: ${result.offers.length} позиций, без записи в каталог`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Проверка не удалась");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю…</p>;
  if (!supplier) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold">Поставщик не найден</h1>
        <p className="mt-2 text-sm text-muted-foreground">Его удалили или ссылка устарела.</p>
        <Link href="/suppliers" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          К списку
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        href="/suppliers"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Все поставщики
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            <Badge variant="secondary">{supplier.code}</Badge>
            <Badge variant="outline">{supplier.source === "api" ? "API" : "Файл"}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {supplier.notes || "Комментарий не задан"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {supplier.source === "api" ? (
            <>
              <Button variant="outline" disabled={busy !== null} onClick={() => void testConnection()}>
                {busy === "test" ? "Проверяю…" : "Проверить ключ"}
              </Button>
              <Button disabled={busy !== null} onClick={() => void runSync()}>
                <RefreshCw className={busy === "sync" ? "animate-spin" : ""} />
                Забрать прайс
              </Button>
            </>
          ) : (
            <Link href="/import" className={cn(buttonVariants())}>
              <Upload />
              Загрузить файл
            </Link>
          )}
          <Button variant="outline" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Последняя загрузка</CardDescription>
            <CardTitle>{formatDateTime(supplier.lastSyncAt)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {supplier.lastSyncStatus === "error"
              ? supplier.lastSyncError
              : `${supplier.lastSyncCount ?? supplierOffers.length} позиций`}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>До Москвы</CardDescription>
            <CardTitle>
              {supplier.deliveryDaysMoscow ? `${supplier.deliveryDaysMoscow} дн.` : "не задан"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {supplier.deliveryNote || "Комментарий по доставке не задан"}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Авторизация</CardDescription>
            <CardTitle className="text-base">
              {supplier.source === "api" ? AUTH_MODE_LABELS[supplier.authMode] : "файл"}
            </CardTitle>
          </CardHeader>
          <CardContent className="truncate font-mono text-xs text-muted-foreground">
            {supplier.apiUrl || "URL не задан"}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>API-ключ</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyField value={supplier.apiKey} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
          <CardDescription>Последние попытки получить прайс</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {supplierLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ещё не загружали.</p>
          ) : (
            supplierLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span>
                  {formatDateTime(log.at)}
                  {log.fileName ? ` · ${log.fileName}` : ""}
                </span>
                <Badge variant={log.status === "ok" ? "secondary" : "destructive"}>
                  {log.status === "ok" ? `${log.imported} шт.` : log.error}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Позиции поставщика</h2>
        <PartsTable
          offers={supplierOffers.slice(0, 40)}
          suppliers={[supplier]}
          empty="Прайс ещё не загружен."
        />
        {supplierOffers.length > 40 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Показаны 40 из {supplierOffers.length}. Полный список — в каталоге.
          </p>
        ) : null}
      </div>

      <SupplierFormDialog
        open={editing}
        onOpenChange={setEditing}
        initial={supplier}
        onSave={(next) => {
          upsertSupplier(next).then(() => toast.success("Изменения сохранены"));
        }}
      />
    </div>
  );
}
