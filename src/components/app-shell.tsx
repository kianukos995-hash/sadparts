"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ClipboardList,
  LayoutGrid,
  Menu,
  PackageSearch,
  Truck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Обзор", icon: LayoutGrid },
  { href: "/catalog", label: "Каталог", icon: PackageSearch },
  { href: "/suppliers", label: "Поставщики", icon: Truck },
  { href: "/import", label: "Загрузка прайса", icon: Upload },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
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
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 py-1">
      <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500 text-zinc-950">
        <ClipboardList className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-wide text-white">АвтоПрайс</span>
        <span className="text-[11px] text-zinc-400">Прайс-листы поставщиков</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-zinc-950 px-3 py-4 md:flex">
        <Brand />
        <div className="mt-6 flex-1">
          <NavLinks />
        </div>
        <p className="px-3 text-[11px] leading-4 text-zinc-500">
          Ключи API хранятся только в этом браузере.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Button variant="outline" size="icon-sm" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <BrandMark />
        </header>
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-zinc-950 p-4 text-white">
          <SheetHeader>
            <SheetTitle className="sr-only">Навигация</SheetTitle>
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
      <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-zinc-950">
        <ClipboardList className="size-4" />
      </span>
      <span className="text-sm font-semibold">АвтоПрайс</span>
    </div>
  );
}
