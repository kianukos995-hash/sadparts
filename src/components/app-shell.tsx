"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  LayoutGrid,
  BookOpen,
  Menu,
  PackagePlus,
  PackageSearch,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PublicSettings } from "@/lib/types";
import { useAvtoPrice } from "@/hooks/use-avtoprice";

const GROUPS = [
  {
    title: "Склад",
    items: [
      { href: "/", label: "Обзор", icon: LayoutGrid },
      { href: "/catalog", label: "Каталог", icon: PackageSearch },
      { href: "/quote", label: "Проценка", icon: Search },
      { href: "/nomenclature", label: "Номенклатура", icon: BookOpen },
    ],
  },
  {
    title: "Сделки",
    items: [
      { href: "/cart", label: "Корзина", icon: ShoppingCart },
      { href: "/orders", label: "Заказы", icon: ClipboardList },
      { href: "/clients", label: "Клиенты", icon: Users },
    ],
  },
  {
    title: "Прайсы",
    items: [
      { href: "/suppliers", label: "Поставщики", icon: Truck },
      { href: "/import", label: "Добавить прайс", icon: PackagePlus },
    ],
  },
  {
    title: "Связки",
    items: [
      { href: "/telegram", label: "Telegram-бот", icon: Send },
      { href: "/settings", label: "Настройки", icon: Settings },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-500/15 text-amber-200"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 py-1">
      <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold tracking-tight text-zinc-950">
        SP
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-wide text-white">SadParts</span>
        <span className="text-[11px] text-zinc-400">Prices</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [bot, setBot] = useState<PublicSettings | null>(null);
  const { draft, drafts } = useAvtoPrice();
  const pathname = usePathname();
  const draftCount = drafts.reduce((sum, order) => sum + order.lines.reduce((s, line) => s + line.qty, 0), 0);
  const printMode = pathname.startsWith("/orders/print");

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((data: PublicSettings) => setBot(data))
      .catch(() => undefined);
  }, []);

  if (printMode) {
    return <div className="min-h-full bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-zinc-950 px-3 py-4 md:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="grid gap-2">
          {draftCount > 0 ? (
            <Link
              href={draft ? `/cart?id=${draft.id}` : "/cart"}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
            >
              Корзина · {drafts.length} зак. · {draftCount} шт.
              {draft ? ` · ${draft.number}` : ""}
            </Link>
          ) : null}
          <div className="rounded-lg border border-white/10 px-3 py-2">
            <p className="text-[11px] text-zinc-500">Telegram</p>
            <p className="truncate text-xs text-zinc-200">
              {bot?.telegramConfigured ? `@${bot.telegramUsername || "бот"}` : "не подключён"}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Button variant="outline" size="icon-sm" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <BrandMark />
          <Link href="/settings" className="ml-auto">
            <Settings className="size-4 text-muted-foreground" />
          </Link>
        </header>
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-zinc-950 p-4 text-white">
          <SheetHeader>
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="mt-6">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-zinc-950">
        SP
      </span>
      <span className="text-sm font-semibold">SadParts Prices</span>
    </div>
  );
}
