"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  CircleDot,
  Cog,
  Droplets,
  Filter,
  Gauge,
  Package,
  Search,
  Settings2,
  Snowflake,
  Wrench,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES, type Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_CARDS: {
  name: Category;
  hint: string;
  icon: typeof Search;
}[] = [
  { name: "Тормозная система", hint: "Колодки, диски, суппорты", icon: CircleDot },
  { name: "Фильтры", hint: "Масляные, воздушные, салон", icon: Filter },
  { name: "Масла и жидкости", hint: "Моторные, трансмиссия, тормозная", icon: Droplets },
  { name: "Подвеска и рулевое", hint: "Стойки, рычаги, наконечники", icon: Gauge },
  { name: "Двигатель", hint: "ГРМ, прокладки, помпы", icon: Cog },
  { name: "Электрика и зажигание", hint: "Свечи, катушки, датчики", icon: Zap },
  { name: "Охлаждение", hint: "Радиаторы, термостаты, патрубки", icon: Snowflake },
  { name: "Трансмиссия", hint: "Сцепление, ШРУСы, масла КПП", icon: Settings2 },
  { name: "Кузов и оптика", hint: "Фонари, зеркала, щётки", icon: Car },
  { name: "Расходники", hint: "Ремкомплекты и мелочёвка", icon: Wrench },
];

export function ClientHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const guest = user?.role === "guest";
  const greeting = useMemo(() => {
    const who = user?.fio || user?.name || (guest ? "гость" : "клиент");
    return guest ? `Здравствуйте, ${who}` : `Здравствуйте, ${who}`;
  }, [guest, user?.fio, user?.name]);

  function goQuote(extra?: { category?: string }) {
    const params = new URLSearchParams();
    if (sku.trim()) params.set("sku", sku.trim());
    if (name.trim()) params.set("name", name.trim());
    if (extra?.category) params.set("category", extra.category);
    const qs = params.toString();
    router.push(qs ? `/quote?${qs}` : "/quote");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Главная</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {greeting}. Выберите категорию запчастей или сразу проценьте артикул — поставщиков не
            показываем, только срок поставки, наличие и цену.
          </p>
        </div>
        <Link href="/quote" className={cn(buttonVariants({ variant: "outline" }))}>
          <Search />
          Открыть проценку
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Проценка</CardTitle>
          <CardDescription>
            Артикул, OEM или название. Полный прайс закрыт: ищем только то, что вы запросили.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Артикул / OEM</Label>
              <Input
                placeholder="например 0986424811 или 4E0698151C"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goQuote();
                }}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Название</Label>
              <Input
                placeholder="колодки, фильтр, стойка…"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") goQuote();
                }}
              />
            </div>
            <Button type="button" onClick={() => goQuote()} disabled={!sku.trim() && !name.trim()}>
              <Search />
              Искать
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Срок в результатах — дни до склада. Имена поставщиков скрыты.
          </p>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Что найти</h2>
            <p className="text-sm text-muted-foreground">
              Поиск по категориям. Список всего каталога не открываем.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_CARDS.filter((item) => CATEGORIES.includes(item.name)).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => goQuote({ category: item.name })}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-amber-400 hover:bg-amber-50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {guest ? (
        <Card>
          <CardHeader>
            <CardTitle>Нужна скидка СТО?</CardTitle>
            <CardDescription>
              Гость видит рыночную цену. Регистрация или ключ от организации открывают клиентский
              кабинет.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/register" className={cn(buttonVariants())}>
              Регистрация
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
              Войти по ключу
            </Link>
          </CardContent>
        </Card>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4" />
          Корзина и заказы — в меню слева. В проценке можно сразу класть позиции.
        </p>
      )}
    </div>
  );
}
