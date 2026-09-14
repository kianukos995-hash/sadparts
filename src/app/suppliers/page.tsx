"use client";

import Link from "next/link";
import { FileSpreadsheet, KeyRound } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { isApiSupplier, isFileSupplier } from "@/lib/money";
import { cn } from "@/lib/utils";

export default function SuppliersHubPage() {
  return (
    <RoleGate allow={["admin", "organization"]}>
      <SuppliersHubInner />
    </RoleGate>
  );
}

function SuppliersHubInner() {
  const { ready, error, refresh, suppliers } = useAvtoPrice();
  const files = suppliers.filter(isFileSupplier).length;
  const api = suppliers.filter(isApiSupplier).length;

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю поставщиков…</p>;

  if (error) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-12 text-center">
        <p className="text-sm font-medium">Не загрузить поставщиков</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button type="button" className={cn(buttonVariants({ variant: "outline" }), "mt-4")} onClick={() => void refresh()}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поставщики</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Разделены по тому, как приходит прайс: файл на диск или живой API.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Файлы и jsonl</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              Поставщики через файлы
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              CSV, ZIP, XLSX и каталоги `data/catalogs/*.jsonl`, в том числе прайс Росско после загрузки.
            </p>
            <p className="text-sm">
              {files} {files === 1 ? "поставщик" : "поставщиков"}
            </p>
            <Link href="/suppliers/files" className={cn(buttonVariants(), "w-fit")}>
              Открыть
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ключи и синхронизация</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5" />
              Поставщики через API
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Росско SOAP KEY1/KEY2, Автопитер, Exist и любой JSON с авторизацией.
            </p>
            <p className="text-sm">
              {api} {api === 1 ? "поставщик" : "поставщиков"}
            </p>
            <Link href="/suppliers/api" className={cn(buttonVariants(), "w-fit")}>
              Открыть
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
