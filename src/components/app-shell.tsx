"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  FileSpreadsheet,
  History,
  KeyRound,
  LayoutGrid,
  BookOpen,
  LogOut,
  Menu,
  PackagePlus,
  PackageSearch,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Shield,
  UserRound,
  Warehouse,
  Wallet,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PublicSettings, UserRole } from "@/lib/types";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/roles";
import { homeHref } from "@/lib/scope";
import { orgAllowsManagerSupplierEdit } from "@/lib/suppliers-scope";

const ALL_GROUPS = [
  {
    title: "Склад",
    roles: ["admin", "organization", "manager"] as UserRole[],
    items: [
      { href: "/", label: "Обзор", icon: LayoutGrid },
      { href: "/catalog", label: "Каталог", icon: PackageSearch },
      { href: "/quote", label: "Проценка", icon: Search },
      { href: "/nomenclature", label: "Номенклатура", icon: BookOpen },
    ],
  },
  {
    title: "Клиенту",
    roles: ["client", "guest"] as UserRole[],
    items: [
      { href: "/quote", label: "Проценка", icon: Search },
      { href: "/cart", label: "Корзина", icon: ShoppingCart },
      { href: "/orders", label: "Заказы", icon: ClipboardList },
      { href: "/clients", label: "Клиенты", icon: Users, roles: ["client"] as UserRole[] },
      { href: "/settings", label: "Настройки", icon: Settings },
    ],
  },
  {
    title: "Сделки",
    roles: ["admin", "organization", "manager"] as UserRole[],
    items: [
      { href: "/cart", label: "Корзина", icon: ShoppingCart },
      { href: "/orders", label: "Заказы", icon: ClipboardList },
      { href: "/invoices", label: "Накладные", icon: FileSpreadsheet },
      { href: "/warehouse", label: "Склад", icon: Warehouse },
      { href: "/money", label: "Деньги", icon: Wallet, roles: ["admin", "organization", "manager"] as UserRole[] },
      { href: "/clients", label: "Клиенты", icon: Users },
    ],
  },
  {
    title: "Прайсы",
    roles: ["admin", "organization", "manager"] as UserRole[],
    items: [
      { href: "/suppliers/files", label: "Поставщики через файлы", icon: FileSpreadsheet },
      { href: "/suppliers/api", label: "Поставщики через API", icon: KeyRound },
      { href: "/import", label: "Добавить прайс", icon: PackagePlus },
    ],
  },
  {
    title: "Контроль",
    roles: ["admin", "organization", "manager"] as UserRole[],
    items: [
      { href: "/organizations", label: "Организации", icon: Building2, roles: ["admin"] as UserRole[] },
      { href: "/team", label: "Команда", icon: Users, roles: ["organization", "manager"] as UserRole[] },
      { href: "/history", label: "История визитов", icon: History },
      { href: "/staff", label: "Ключи и регистрации", icon: Shield, roles: ["admin"] as UserRole[] },
      { href: "/staff", label: "Ключи клиентов", icon: KeyRound, roles: ["organization", "manager"] as UserRole[] },
      { href: "/telegram", label: "Telegram-бот", icon: Send, roles: ["admin"] as UserRole[] },
      { href: "/settings", label: "Настройки", icon: Settings },
    ],
  },
];

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role: UserRole }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { organizations } = useAvtoPrice();
  let groups = ALL_GROUPS.filter((group) => group.roles.includes(role)).map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  }));
  if (role === "manager" && !orgAllowsManagerSupplierEdit(organizations, user?.organizationId)) {
    groups = groups.filter((group) => group.title !== "Прайсы");
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
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
                key={`${item.href}:${item.label}`}
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

function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-2 py-1">
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
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const role = user?.role ?? "guest";
  const draftCount = drafts.reduce((sum, order) => sum + order.lines.reduce((s, line) => s + line.qty, 0), 0);
  const printMode = pathname.startsWith("/orders/print");
  const startHref = useMemo(() => homeHref(role), [role]);

  useEffect(() => {
    if (role !== "admin") return;
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((data: PublicSettings) => setBot(data))
      .catch(() => undefined);
  }, [role]);

  if (printMode) {
    return <div className="min-h-full bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-zinc-950 px-3 py-4 md:flex">
        <Brand href={startHref} />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks role={role} />
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
            <p className="text-[11px] text-zinc-500">{ROLE_LABELS[role]}</p>
            <p className="truncate text-xs text-zinc-200">{user?.email || user?.name}</p>
          </div>
          {role === "admin" ? (
            <div className="rounded-lg border border-white/10 px-3 py-2">
              <p className="text-[11px] text-zinc-500">Telegram</p>
              <p className="truncate text-xs text-zinc-200">
                {bot?.telegramConfigured ? `@${bot.telegramUsername || "бот"}` : "не подключён"}
              </p>
            </div>
          ) : null}
          <Button
            variant="outline"
            className="justify-start border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
            onClick={() => void logout()}
          >
            <LogOut />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur md:px-8">
          <Button variant="outline" size="icon-sm" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <Link href={startHref} className="md:hidden">
            <BrandMark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={draft ? `/cart?id=${draft.id}` : "/cart"}
              className={cn(
                "relative inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted",
                pathname.startsWith("/cart") && "border-amber-400 bg-amber-50",
              )}
            >
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">Корзина</span>
              {draftCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-amber-500 px-1 text-center text-[10px] font-semibold text-zinc-950">
                  {draftCount}
                </span>
              ) : null}
            </Link>
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-zinc-950 p-4 text-white">
          <SheetHeader>
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <Brand href={startHref} />
          </SheetHeader>
          <div className="mt-6">
            <NavLinks role={role} onNavigate={() => setOpen(false)} />
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full justify-start border-white/15 bg-transparent text-zinc-200"
            onClick={() => void logout()}
          >
            <LogOut />
            Выйти
          </Button>
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

function ProfileMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const initials = (user?.fio || user?.name || "?").slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold">
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from local media
          <img src={user.avatarUrl} alt="" className="size-9 object-cover" />
        ) : (
          initials
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>
          <p className="truncate text-sm text-foreground">{user?.fio || user?.name}</p>
          <p className="truncate text-xs font-normal">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserRound />
          Профиль
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings />
          Настройки
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
