"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PackageSearch, ShoppingCart, ClipboardList, Wallet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { ClientHome } from "@/components/client-home";
import { RoleGate } from "@/components/role-gate";
import { formatMoney } from "@/lib/format";
import { clientNavOnly } from "@/lib/scope";
import { isSupplierConnected } from "@/lib/supplier-presets";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }
  if (user && clientNavOnly(user.role)) {
    return <ClientHome />;
  }
  return (
    <RoleGate allow={["admin", "organization", "manager"]}>
      <HomeInner />
    </RoleGate>
  );
}

function HomeInner() {
  const { ready, suppliers, offers, resetDemo } = useAvtoPrice();
  const { user } = useAuth();
  const admin = user?.role === "admin";

  const stats = useMemo(() => {
    const connected = suppliers.filter(isSupplierConnected).length;
    const offline = Math.max(0, suppliers.length - connected);
    const fileRows = suppliers.reduce((sum, item) => sum + (item.catalogCount ?? 0), 0);
    const brands = new Set(offers.map((offer) => offer.brand));
    const inStock = offers.filter((offer) => offer.stock > 0).length;
    const avg =
      offers.length === 0 ? 0 : offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length;
    return { connected, offline, brands: brands.size, inStock, avg, fileRows };
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
            {admin
              ? "Сводка по складу. Поставщиков и прайсы подключайте в Настройках."
              : "Рабочий стол организации: проценка, клиенты, заказы. Ключи и добавление поставщиков — в Настройках."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/quote" className={cn(buttonVariants())}>
            <PackageSearch />
            Проценка
          </Link>
          <Link href="/cart" className={cn(buttonVariants({ variant: "outline" }))}>
            <ShoppingCart />
            Корзина
          </Link>
          <Link href="/orders" className={cn(buttonVariants({ variant: "outline" }))}>
            <ClipboardList />
            Заказы
          </Link>
          {admin || user?.role === "organization" ? (
            <Link href="/money" className={cn(buttonVariants({ variant: "outline" }))}>
              <Wallet />
              Деньги
            </Link>
          ) : null}
          <Link href="/catalog" className={cn(buttonVariants({ variant: "outline" }))}>
            Каталог
          </Link>
          <Link href="/settings" className={cn(buttonVariants({ variant: "outline" }))}>
            Настройки
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Подключено" value={String(stats.connected)} hint="есть прайс или живой API" />
        <Stat title="Не подключено" value={String(stats.offline)} hint="добавлены, но без прайса" />
        <Stat
          title="Позиции в прайсах"
          value={String(stats.fileRows || offers.length)}
          hint={`${stats.inStock} демо в наличии`}
        />
        <Stat title="Бренды" value={String(stats.brands)} hint={`средняя ${formatMoney(stats.avg)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Поставщики</CardTitle>
          <CardDescription>Только счётчики. Список, ключи и файлы — в Настройках → Поставщики.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <p>
            <span className="text-2xl font-semibold tracking-tight">{stats.connected}</span>
            <span className="ml-2 text-muted-foreground">подключено</span>
          </p>
          <p>
            <span className="text-2xl font-semibold tracking-tight">{stats.offline}</span>
            <span className="ml-2 text-muted-foreground">не подключено</span>
          </p>
          <p>
            <span className="text-2xl font-semibold tracking-tight">{suppliers.length}</span>
            <span className="ml-2 text-muted-foreground">в рабочем списке</span>
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {admin
            ? "Демо-поставщики Росско, Автопитер и Exist уже в списке. Новых подключайте из каталога в Настройках."
            : user?.role === "organization"
              ? "Рабочий стол организации. Цены и ключи администратора скрыты."
              : "Проценка и заказы клиентов, которым выдан ключ. Админские цены скрыты."}
        </p>
        {admin ? (
          <Button variant="ghost" onClick={resetDemo}>
            Сбросить демо
          </Button>
        ) : null}
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
