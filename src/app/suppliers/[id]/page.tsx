"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuppliersGate } from "@/components/suppliers-gate";
import { KeyField } from "@/components/key-field";
import { PartsTable } from "@/components/parts-table";
import { PriceListUpload } from "@/components/price-list-upload";
import { SupplierFormDialog } from "@/components/supplier-form";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_MODE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { fetchSupplierPayload, payloadToOffers, buildSyncLog, syncSupplier } from "@/lib/sync";
import { isApiSupplier } from "@/lib/money";
import { canEditSupplier, isAdminOwnedSupplier } from "@/lib/suppliers-scope";
import { cn } from "@/lib/utils";
import type { Offer } from "@/lib/types";

export default function SupplierDetailPage() {
  return (
    <SuppliersGate>
      <SupplierDetailInner />
    </SuppliersGate>
  );
}

function SupplierDetailInner() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    ready,
    suppliers,
    organizations,
    offers,
    logs,
    upsertSupplier,
    replaceOffers,
    shareSupplier,
  } = useAvtoPrice();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"sync" | "test" | null>(null);
  const [fileOffers, setFileOffers] = useState<Offer[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [browseState, setBrowseState] = useState<"loading" | "ok" | "error">("loading");

  const supplier = suppliers.find((item) => item.id === params.id);
  const catalogHint = supplier?.catalogCount ?? supplier?.lastSyncCount ?? fileTotal;
  const supplierOffers = useMemo(() => {
    if (fileOffers.length) return fileOffers;
    return offers.filter((offer) => offer.supplierId === params.id);
  }, [offers, params.id, fileOffers]);

  const reloadCatalog = useCallback(() => {
    if (!params.id) return;
    void fetch(`/api/catalog/browse?supplierId=${encodeURIComponent(params.id)}&pageSize=40`)
      .then(async (response) => {
        const data = (await response.json()) as { offers?: Offer[]; total?: number; error?: string };
        if (!response.ok) throw new Error(data.error || "browse failed");
        setFileOffers(data.offers ?? []);
        setFileTotal(data.total ?? 0);
        setBrowseState("ok");
      })
      .catch(() => {
        setBrowseState("error");
      });
  }, [params.id]);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);
  const supplierLogs = logs.filter((log) => log.supplierId === params.id).slice(0, 8);

  async function runSync() {
    if (!supplier) return;
    setBusy("sync");
    try {
      if (supplier.adapter === "rossko") {
        await testConnection();
        return;
      }
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
      if (supplier.adapter === "rossko") {
        const response = await fetch("/api/rossko", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", supplierId: supplier.id }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || "Ключи не приняты");
        toast.success("GetCheckoutDetails: KEY1 и KEY2 приняты");
        return;
      }
      const payload = await fetchSupplierPayload(supplier);
      const result = payloadToOffers(payload, supplier);
      toast.success(`Ответ получен: ${result.offers.length} позиций, без записи в каталог`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Проверка не удалась");
    } finally {
      setBusy(null);
    }
  }

  const backHref = supplier && isApiSupplier(supplier) ? "/suppliers/api" : "/suppliers/files";
  const backLabel =
    supplier && isApiSupplier(supplier) ? "Поставщики через API" : "Поставщики через файлы";
  const editable = supplier ? canEditSupplier(supplier, user, organizations) : false;

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
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            <Badge variant="secondary">{supplier.code}</Badge>
            <Badge variant="outline">{supplier.source === "api" ? "API" : "Файл"}</Badge>
            {isAdminOwnedSupplier(supplier) || supplier.lockedByAdmin ? (
              <Badge variant="outline" className="border-amber-400 text-amber-800">
                Админ · замок
              </Badge>
            ) : (
              <Badge variant="secondary">Свой</Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {supplier.notes || "Комментарий не задан"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (supplier.source === "api" || supplier.adapter === "rossko") ? (
            <>
              <Button variant="outline" disabled={busy !== null} onClick={() => void testConnection()}>
                {busy === "test"
                  ? "Проверяю…"
                  : supplier.adapter === "rossko"
                    ? "Проверить KEY1/KEY2"
                    : "Проверить ключ"}
              </Button>
              {supplier.adapter !== "rossko" ? (
                <Button disabled={busy !== null} onClick={() => void runSync()}>
                  <RefreshCw className={busy === "sync" ? "animate-spin" : ""} />
                  Забрать прайс
                </Button>
              ) : null}
            </>
          ) : null}
          {editable ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Изменить
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Ключи и поля закреплены администратором.</p>
          )}
        </div>
      </div>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>Прайс-лист файлом</CardTitle>
            <CardDescription>
              Файл пишется в каталог этого поставщика. Карта колонок из вкладки «Поля прайса» имеет приоритет
              над автоподбором.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceListUpload supplier={supplier} variant="dropzone" onImported={() => reloadCatalog()} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Прайс администратора</CardTitle>
            <CardDescription>
              Позиции видны в каталоге. Загрузка файла, синхронизация и ключи доступны только администратору.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {user?.role === "admin" && organizations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Доступ организациям</CardTitle>
            <CardDescription>
              Отметьте, кому показать этого поставщика. Свои поставщики организации не затрагиваются.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {organizations.map((org) => {
              const shared = (supplier.sharedWithOrgIds ?? []).includes(org.id);
              return (
                <label key={org.id} className="flex items-center gap-2 text-sm">
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
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Последняя загрузка</CardDescription>
            <CardTitle>{formatDateTime(supplier.lastSyncAt)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {supplier.lastSyncStatus === "error"
              ? supplier.lastSyncError
              : `${supplier.catalogCount ?? supplier.lastSyncCount ?? fileTotal} позиций`}
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
              {supplier.source === "api" || supplier.adapter === "rossko"
                ? AUTH_MODE_LABELS[supplier.authMode]
                : "файл"}
            </CardTitle>
          </CardHeader>
          <CardContent className="truncate text-xs text-muted-foreground">
            <p className="font-mono">{supplier.apiUrl || "URL не задан"}</p>
            {supplier.authMode === "header" && supplier.authHeaderName ? (
              <p className="mt-1">заголовок {supplier.authHeaderName}</p>
            ) : null}
            {supplier.authMode === "query" && supplier.authQueryParam ? (
              <p className="mt-1">параметр {supplier.authQueryParam}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{supplier.adapter === "rossko" ? "KEY1" : "API-ключ / KEY1"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {editable ? (
              <>
                <KeyField value={supplier.apiKey} />
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">KEY2</p>
                  <KeyField value={supplier.apiKey2} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ключи скрыты.</p>
            )}
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
        <h2 className="mb-3 flex flex-wrap items-center gap-3 text-lg font-medium">
          <span>
            Позиции прайса
            {fileTotal || catalogHint
              ? ` · ${(fileTotal || catalogHint).toLocaleString("ru-RU")}`
              : ""}
          </span>
          <Link href="/catalog" className="text-sm font-normal text-muted-foreground hover:underline">
            Каталог
          </Link>
          <Link href="/quote" className="text-sm font-normal text-muted-foreground hover:underline">
            Проценка
          </Link>
        </h2>
        {browseState === "loading" && supplierOffers.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            Читаю прайс с диска…
          </p>
        ) : browseState === "error" && supplierOffers.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            <p>Не удалось показать позиции. Прайс на диске есть — повторите чтение.</p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => {
                setBrowseState("loading");
                reloadCatalog();
              }}
            >
              Показать позиции
            </Button>
          </div>
        ) : (
          <PartsTable
            offers={supplierOffers.slice(0, 40)}
            suppliers={[supplier]}
            empty="Прайс ещё не загружен. Выберите файл в блоке выше."
          />
        )}
        {fileTotal > 40 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Показаны 40 из {fileTotal.toLocaleString("ru-RU")}. Полный список — в каталоге и проценке.
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
