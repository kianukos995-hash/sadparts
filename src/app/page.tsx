"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PackageSearch, RefreshCw, Truck, Upload, AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { daysSince, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { ready, suppliers, offers, logs, resetDemo } = useAvtoPrice();

  const stats = useMemo(() => {
    const brands = new Set(offers.map((offer) => offer.brand));
    const inStock = offers.filter((offer) => offer.stock > 0).length;
    const avg =
      offers.length === 0
        ? 0
        : offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length;
    const stale = suppliers.filter(
      (supplier) => supplier.source === "api" && daysSince(supplier.lastSyncAt) > 1,
    );
    return { brands: brands.size, inStock, avg, stale };
  }, [offers, suppliers]);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Загрузка данных поставщиков…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Обзор склада прайсов</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ключи API поставщиков, загрузка прайсов файлом, ссылкой или вставкой, Telegram-бот по
            каталогу автозапчастей.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog" className={cn(buttonVariants())}>
            <PackageSearch />
            Открыть каталог
          </Link>
          <Link href="/import" className={cn(buttonVariants({ variant: "outline" }))}>
            <Upload />
            Добавить прайс
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Поставщики" value={String(suppliers.length)} hint="активные источники" />
        <Stat title="Позиции" value={String(offers.length)} hint={`${stats.inStock} в наличии`} />
        <Stat title="Бренды" value={String(stats.brands)} hint="в текущем каталоге" />
        <Stat
          title="Средняя цена"
          value={formatMoney(stats.avg)}
          hint="по всем предложениям"
        />
      </div>

      {stats.stale.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="size-4" />
              Прайсы устарели
            </CardTitle>
            <CardDescription>
              Нет свежей синхронизации больше суток:{" "}
              {stats.stale.map((item) => item.name).join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/suppliers" className={cn(buttonVariants({ variant: "outline" }))}>
              <RefreshCw />
              К поставщикам
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Поставщики</CardTitle>
            <CardDescription>Ключи и способ получения прайса</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Поставщиков пока нет.</p>
            ) : (
              suppliers.map((supplier) => (
                <Link
                  key={supplier.id}
                  href={`/suppliers/${supplier.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.source === "api" ? "API" : "Файл"} ·{" "}
                        {formatDateTime(supplier.lastSyncAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={supplier.lastSyncStatus === "error" ? "destructive" : "secondary"}>
                    {supplier.lastSyncCount ?? 0} поз.
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние загрузки</CardTitle>
            <CardDescription>Синхронизации API и файлы</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">История пуста.</p>
            ) : (
              logs.slice(0, 8).map((log) => {
                const supplier = suppliers.find((item) => item.id === log.supplierId);
                return (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{supplier?.name ?? "Поставщик удалён"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.at)}
                        {log.fileName ? ` · ${log.fileName}` : ""}
                      </p>
                    </div>
                    <Badge variant={log.status === "ok" ? "secondary" : "destructive"}>
                      {log.status === "ok" ? `${log.imported} шт.` : "ошибка"}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Демо-поставщики Росско, Автопитер и Exist уже подключены. Их ключи можно заменить на
          боевые. Telegram-бот читает этот же каталог.
        </p>
        <Button variant="ghost" onClick={resetDemo}>
          Сбросить демо
        </Button>
      </div>
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}
