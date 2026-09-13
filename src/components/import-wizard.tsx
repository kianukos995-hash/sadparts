"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { FIELD_LABELS } from "@/lib/constants";
import { guessColumnMap, mapPayloadToOffers } from "@/lib/mapping";
import { buildSyncLog } from "@/lib/sync";
import type { ColumnMap, ParsedTable } from "@/lib/types";
import { FIELD_KEYS } from "@/lib/types";

export function ImportWizard() {
  const { suppliers, replaceOffers } = useAvtoPrice();
  const [supplierId, setSupplierId] = useState(suppliers.find((item) => item.source === "file")?.id ?? suppliers[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplier = suppliers.find((item) => item.id === supplierId);

  const preview = useMemo(() => table?.rows.slice(0, 6) ?? [], [table]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/parse-price-list", { method: "POST", body: form });
      const data = (await response.json()) as ParsedTable & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать файл");
      setTable(data);
      setMap(guessColumnMap(data.headers));
    } catch (err) {
      setTable(null);
      setMap(null);
      setError(err instanceof Error ? err.message : "Ошибка чтения файла");
    } finally {
      setBusy(false);
    }
  }

  function importNow() {
    if (!supplier || !table || !map) return;
    const { offers, skipped } = mapPayloadToOffers(table.rows, {
      ...supplier,
      columnMap: map,
      source: "file",
    });
    if (offers.length === 0) {
      toast.error("Не нашлось строк с артикулом. Проверьте соответствие колонок.");
      return;
    }
    const log = buildSyncLog(supplier, { offers, skipped }, "file", fileName);
    replaceOffers(supplier.id, offers, log);
    toast.success(`Загружено ${offers.length} позиций от «${supplier.name}»`);
    setTable(null);
    setMap(null);
    setFileName("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Файл прайс-листа</CardTitle>
          <CardDescription>
            CSV или Excel (.xlsx). Первая строка — заголовки. Русские и английские названия колонок
            распознаются сами.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-1.5">
            <Label>Поставщик</Label>
            <Select
              value={supplierId}
              onValueChange={(value) => {
                if (value) setSupplierId(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите поставщика" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center hover:bg-muted/40"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void onFile(event.dataTransfer.files[0]);
            }}
          >
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">Перетащите файл или нажмите, чтобы выбрать</span>
            <span className="text-xs text-muted-foreground">До 8 МБ · CSV, XLSX</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>

          {busy ? <p className="text-sm text-muted-foreground">Читаю файл…</p> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Файл не принят</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {table && map ? (
            <div className="grid gap-3">
              <p className="text-sm">
                <FileSpreadsheet className="mr-1 inline size-4" />
                {fileName} · {table.total} строк
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELD_KEYS.map((field) => (
                  <label key={field} className="grid gap-1.5">
                    <Label>{FIELD_LABELS[field]}</Label>
                    <Select
                      value={map[field] || "__none__"}
                      onValueChange={(value) =>
                        setMap((prev) =>
                          prev
                            ? { ...prev, [field]: value === "__none__" ? "" : (value as string) }
                            : prev,
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Колонка" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— не использовать —</SelectItem>
                        {table.headers.map((header) => (
                          <SelectItem key={`${field}-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ))}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {table.headers.map((header) => (
                        <th key={header} className="px-2 py-1.5 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index} className="border-t">
                        {table.headers.map((header) => (
                          <td key={header} className="px-2 py-1.5 whitespace-nowrap">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={importNow} disabled={!supplier}>
                Загрузить в каталог
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Шаблон</CardTitle>
          <CardDescription>
            Если у поставщика нет API, выгрузите прайс в CSV и загрузите сюда.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <a
            href="/samples/price-list-example.csv"
            download
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            Скачать пример CSV
          </a>
          <p className="text-xs text-muted-foreground">
            Колонки: Артикул, Бренд, Наименование, OEM, Категория, Цена, Валюта, Остаток, Склад.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
