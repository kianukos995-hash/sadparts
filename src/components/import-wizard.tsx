"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Link2, RefreshCw, Type, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PricePreviewCard, type PricePreview } from "@/components/price-preview";
import { cn } from "@/lib/utils";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { FIELD_LABELS } from "@/lib/constants";
import { guessColumnMap, mapPayloadToOffers } from "@/lib/mapping";
import { guessPriceTitle } from "@/lib/price-bands";
import { buildSyncLog, fetchFeedTable, syncSupplier } from "@/lib/sync";
import { offerKey } from "@/lib/format";
import type { AuthMode, ColumnMap, ImportMode, ParsedTable, Supplier, SupplierSource } from "@/lib/types";
import { CATEGORIES, FIELD_KEYS } from "@/lib/types";
import { AUTH_MODE_LABELS } from "@/lib/constants";

export function ImportWizard() {
  const { suppliers, replaceOffers, refresh } = useAvtoPrice();
  const [supplierId, setSupplierId] = useState(
    suppliers.find((item) => item.source === "file")?.id ?? suppliers[0]?.id ?? "",
  );
  const [mode, setMode] = useState<ImportMode>("replace");

  const supplier = suppliers.find((item) => item.id === supplierId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <Card>
        <CardHeader>
          <CardTitle>Источник прайса</CardTitle>
          <CardDescription>
            Файл, ссылка, вставка JSON/CSV/XML, синхронизация API или одна позиция вручную.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SupplierSelect
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={mode === "merge"}
              onCheckedChange={(checked) => setMode(checked === true ? "merge" : "replace")}
            />
            Добавить к текущему прайсу, не затирая остальные артикулы
          </label>

          <Tabs defaultValue="file">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="file">Файл</TabsTrigger>
              <TabsTrigger value="url">Ссылка</TabsTrigger>
              <TabsTrigger value="paste">Вставить</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
              <TabsTrigger value="manual">Вручную</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <FilePane supplier={supplier} mode={mode} onImport={replaceOffers} onRefresh={refresh} />
            </TabsContent>
            <TabsContent value="url" className="mt-4">
              <UrlPane supplier={supplier} mode={mode} onImport={replaceOffers} />
            </TabsContent>
            <TabsContent value="paste" className="mt-4">
              <PastePane supplier={supplier} mode={mode} onImport={replaceOffers} />
            </TabsContent>
            <TabsContent value="api" className="mt-4">
              <ApiPane suppliers={suppliers} mode={mode} onImport={replaceOffers} />
            </TabsContent>
            <TabsContent value="manual" className="mt-4">
              <ManualPane supplier={supplier} mode={mode} onImport={replaceOffers} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Шаблоны</CardTitle>
          <CardDescription>Если у поставщика нет API — выгрузите прайс и загрузите сюда.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <a
            href="/samples/price-list-example.csv"
            download
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            Пример CSV
          </a>
          <a
            href="/samples/price-crooked.csv"
            download
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            Кривой CSV (для проверки)
          </a>
          <p className="text-xs text-muted-foreground">
            ZIP/CSV Росско и кривые выгрузки: лишняя шапка, кавычки, windows-1251. Сначала просмотр и
            имя прайса, потом запись. Откат — в истории ниже.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SupplierSelect({
  suppliers,
  value,
  onChange,
}: {
  suppliers: Supplier[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Label>Поставщик</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        <SelectTrigger className="w-full">
          <span className="flex flex-1 truncate text-left">
            {suppliers.find((item) => item.id === value)?.name ?? "Выберите поставщика"}
          </span>
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
  );
}

type ImportFn = ReturnType<typeof useAvtoPrice>["replaceOffers"];

function MappingBlock({
  table,
  map,
  setMap,
  fileName,
  onConfirm,
  busy,
}: {
  table: ParsedTable;
  map: ColumnMap;
  setMap: (map: ColumnMap) => void;
  fileName: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const preview = useMemo(() => table.rows.slice(0, 5), [table]);
  return (
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
                setMap({ ...map, [field]: value === "__none__" ? "" : (value as string) })
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
      <Button onClick={onConfirm} disabled={busy}>
        {busy ? "Сохраняю…" : "Загрузить в каталог"}
      </Button>
    </div>
  );
}

async function commitTable(
  supplier: Supplier,
  table: ParsedTable,
  map: ColumnMap,
  source: SupplierSource,
  fileName: string,
  mode: ImportMode,
  onImport: ImportFn,
  label?: string,
) {
  const { offers, skipped } = mapPayloadToOffers(table.rows, {
    ...supplier,
    columnMap: map,
    source,
  });
  if (offers.length === 0) {
    throw new Error("Не нашлось строк с артикулом. Проверьте соответствие колонок.");
  }
  const log = buildSyncLog(supplier, { offers, skipped }, source, fileName, label);
  await onImport(supplier.id, offers, log, mode);
  return offers.length;
}

function isBulkPrice(file: File, supplier?: Supplier) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    name.endsWith(".xml") ||
    file.size > 400_000 ||
    supplier?.adapter === "rossko"
  );
}

async function previewBulkFile(file: File, supplierId: string) {
  const form = new FormData();
  form.set("action", "preview");
  form.set("file", file);
  form.set("supplierId", supplierId);
  const response = await fetch("/api/catalog/import", { method: "POST", body: form });
  const data = (await response.json()) as PricePreview & { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось просмотреть файл");
  return data;
}

async function importBulkFile(file: File, supplierId: string, mode: ImportMode, label: string) {
  const form = new FormData();
  form.set("action", "import");
  form.set("file", file);
  form.set("supplierId", supplierId);
  form.set("mode", mode);
  form.set("label", label);
  const response = await fetch("/api/catalog/import", { method: "POST", body: form });
  const data = (await response.json()) as {
    imported?: number;
    skipped?: number;
    error?: string;
    label?: string;
  };
  if (!response.ok) throw new Error(data.error || "Не удалось загрузить прайс");
  return data;
}

function FilePane({
  supplier,
  mode,
  onImport,
  onRefresh,
}: {
  supplier?: Supplier;
  mode: ImportMode;
  onImport: ImportFn;
  onRefresh: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [label, setLabel] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetPreview() {
    setPreview(null);
    setTable(null);
    setMap(null);
    setFiles([]);
    setFileName("");
    setLabel("");
  }

  async function onFiles(list: FileList | File[] | undefined) {
    const next = list ? Array.from(list) : [];
    if (next.length === 0) return;
    setBusy(true);
    setError(null);
    setTable(null);
    setMap(null);
    setPreview(null);
    try {
      if (!supplier) throw new Error("Выберите поставщика");
      const file = next[0];
      setFiles(next);
      setFileName(file.name);
      if (isBulkPrice(file, supplier) || next.length > 1) {
        const data = await previewBulkFile(file, supplier.id);
        setPreview(data);
        setLabel(data.title || guessPriceTitle(file.name));
        return;
      }
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/parse-price-list", { method: "POST", body: form });
      const data = (await response.json()) as ParsedTable & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось прочитать файл");
      setTable(data);
      setMap(guessColumnMap(data.headers));
      setPreview({
        title: guessPriceTitle(file.name),
        headers: data.headers,
        rows: data.rows.slice(0, 25),
        total: data.total,
        warnings: data.warnings,
      });
      setLabel(guessPriceTitle(file.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка чтения файла");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!supplier) throw new Error("Выберите поставщика");
    const title = label.trim() || guessPriceTitle(fileName);
    if (table && map && files.length === 1 && !isBulkPrice(files[0], supplier)) {
      await commitTable(supplier, table, map, "file", fileName, mode, onImport, title);
      toast.success(`«${title}»: загружено в каталог`);
      resetPreview();
      return;
    }
    let total = 0;
    for (const file of files) {
      const name = file === files[0] ? title : guessPriceTitle(file.name);
      const result = await importBulkFile(file, supplier.id, mode, name);
      total += result.imported ?? 0;
    }
    await onRefresh();
    toast.success(
      files.length > 1
        ? `Из ${files.length} файлов на сервере ${total} позиций`
        : `«${title}»: ${total} позиций. Можно откатить в истории.`,
    );
    resetPreview();
  }

  return (
    <div className="grid gap-4">
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center hover:bg-muted/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">Перетащите файлы или нажмите, чтобы выбрать</span>
        <span className="text-xs text-muted-foreground">
          CSV, ZIP, XLSX, JSON, XML/YML · сначала просмотр, имя прайса — по имени файла
        </span>
        <input
          type="file"
          multiple
          accept=".csv,.zip,.xlsx,.xls,.json,.xml,.yml,text/csv,application/json,application/xml,application/zip"
          className="sr-only"
          onChange={(event) => void onFiles(event.target.files ?? undefined)}
        />
      </label>
      {busy ? <p className="text-sm text-muted-foreground">Читаю файл…</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Файл не принят</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {preview ? (
        <PricePreviewCard
          preview={preview}
          label={label}
          onLabelChange={setLabel}
          fileName={fileName}
          showTable={!(table && map)}
        />
      ) : null}
      {table && map && supplier && files.length === 1 && !isBulkPrice(files[0], supplier) ? (
        <MappingBlock
          table={table}
          map={map}
          setMap={setMap}
          fileName={fileName}
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            void confirmImport()
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
              .finally(() => setBusy(false));
          }}
        />
      ) : preview && supplier ? (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void confirmImport()
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Сохраняю…" : files.length > 1 ? `Загрузить ${files.length} прайса` : "Загрузить прайс"}
        </Button>
      ) : null}
    </div>
  );
}

function UrlPane({
  supplier,
  mode,
  onImport,
}: {
  supplier?: Supplier;
  mode: ImportMode;
  onImport: ImportFn;
}) {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("header");
  const [itemsPath, setItemsPath] = useState("items");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <Label>URL JSON, CSV или XML/YML</Label>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://supplier.ru/price.xml"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <Label>Авторизация</Label>
          <Select
            value={authMode}
            onValueChange={(value) => {
              if (value) setAuthMode(value as AuthMode);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AUTH_MODE_LABELS) as AuthMode[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {AUTH_MODE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5">
          <Label>Ключ (если нужен)</Label>
          <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </label>
      </div>
      <label className="grid gap-1.5">
        <Label>JSON-путь к позициям</Label>
        <Input
          value={itemsPath}
          onChange={(event) => setItemsPath(event.target.value)}
          placeholder="items или data.products"
        />
      </label>
      <Button
        disabled={busy || !url.trim() || !supplier}
        onClick={() => {
          setBusy(true);
          void fetchFeedTable({
            url,
            apiKey,
            authMode,
            itemsPath,
          })
            .then((next) => {
              setTable(next);
              setMap(guessColumnMap(next.headers));
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
            .finally(() => setBusy(false));
        }}
      >
        <Link2 />
        Забрать по ссылке
      </Button>
      {table && map && supplier ? (
        <MappingBlock
          table={table}
          map={map}
          setMap={setMap}
          fileName={url}
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            void commitTable(supplier, table, map, "url", url, mode, onImport)
              .then((count) => {
                toast.success(`Загружено ${count} позиций`);
                setTable(null);
                setMap(null);
              })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </div>
  );
}

function PastePane({
  supplier,
  mode,
  onImport,
}: {
  supplier?: Supplier;
  mode: ImportMode;
  onImport: ImportFn;
}) {
  const [text, setText] = useState("");
  const [itemsPath, setItemsPath] = useState("items");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <Label>JSON, CSV или XML</Label>
        <Textarea
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='{"items":[{"sku":"W71275","brand":"MANN-FILTER","price":890}]}'
        />
      </label>
      <label className="grid gap-1.5">
        <Label>JSON-путь к массиву</Label>
        <Input value={itemsPath} onChange={(event) => setItemsPath(event.target.value)} />
      </label>
      <Button
        disabled={busy || !text.trim() || !supplier}
        onClick={() => {
          setBusy(true);
          const form = new FormData();
          form.set("text", text);
          form.set("itemsPath", itemsPath);
          void fetch("/api/parse-price-list", { method: "POST", body: form })
            .then(async (response) => {
              const data = (await response.json()) as ParsedTable & { error?: string };
              if (!response.ok) throw new Error(data.error || "Не разобрать");
              setTable(data);
              setMap(guessColumnMap(data.headers));
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
            .finally(() => setBusy(false));
        }}
      >
        <Type />
        Разобрать текст
      </Button>
      {table && map && supplier ? (
        <MappingBlock
          table={table}
          map={map}
          setMap={setMap}
          fileName="вставка"
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            void commitTable(supplier, table, map, "paste", "paste", mode, onImport)
              .then((count) => {
                toast.success(`Загружено ${count} позиций`);
                setTable(null);
                setMap(null);
              })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </div>
  );
}

function ApiPane({
  suppliers,
  mode,
  onImport,
}: {
  suppliers: Supplier[];
  mode: ImportMode;
  onImport: ImportFn;
}) {
  const apiSuppliers = suppliers.filter((item) => item.source === "api");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (apiSuppliers.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет поставщиков с API.</p>;
  }

  return (
    <div className="grid gap-2">
      {apiSuppliers.map((supplier) => (
        <div key={supplier.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-medium">{supplier.name}</p>
            <p className="truncate text-xs text-muted-foreground">{supplier.apiUrl}</p>
          </div>
          <Button
            size="sm"
            disabled={busyId !== null}
            onClick={() => {
              setBusyId(supplier.id);
              void syncSupplier(supplier)
                .then((result) =>
                  onImport(supplier.id, result.offers, buildSyncLog(supplier, result, "api"), mode),
                )
                .then(() => toast.success(`${supplier.name}: прайс обновлён`))
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
                .finally(() => setBusyId(null));
            }}
          >
            <RefreshCw className={busyId === supplier.id ? "animate-spin" : ""} />
            Синхр.
          </Button>
        </div>
      ))}
    </div>
  );
}

function ManualPane({
  supplier,
  mode,
  onImport,
}: {
  supplier?: Supplier;
  mode: ImportMode;
  onImport: ImportFn;
}) {
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [oem, setOem] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Расходники");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [warehouse, setWarehouse] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Артикул">
        <Input value={sku} onChange={(event) => setSku(event.target.value)} />
      </Field>
      <Field label="Бренд">
        <Input value={brand} onChange={(event) => setBrand(event.target.value)} />
      </Field>
      <Field label="Наименование">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="OEM">
        <Input value={oem} onChange={(event) => setOem(event.target.value)} />
      </Field>
      <Field label="Категория">
        <Select
          value={category}
          onValueChange={(value) => {
            if (value) setCategory(value as (typeof CATEGORIES)[number]);
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">{category}</span>
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Цена, ₽">
        <Input value={price} onChange={(event) => setPrice(event.target.value)} />
      </Field>
      <Field label="Остаток">
        <Input value={stock} onChange={(event) => setStock(event.target.value)} />
      </Field>
      <Field label="Склад">
        <Input value={warehouse} onChange={(event) => setWarehouse(event.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button
          disabled={busy || !supplier || !sku.trim() || !name.trim()}
          onClick={() => {
            if (!supplier) return;
            const normalized = sku.replace(/\s+/g, "").toUpperCase();
            const offer = {
              id: offerKey(supplier.id, normalized),
              supplierId: supplier.id,
              sku: normalized,
              brand: brand.trim() || "—",
              name: name.trim(),
              oem: oem.replace(/\s+/g, "").toUpperCase(),
              category,
              price: Number.parseFloat(price.replace(",", ".")) || 0,
              currency: "RUB",
              stock: Math.max(0, Math.round(Number.parseFloat(stock) || 0)),
              warehouse: warehouse.trim(),
              multiplicity: 1,
              deliveryDays: supplier.deliveryDaysMoscow || 2,
              displayName: "",
              crossOems: [],
              updatedAt: new Date().toISOString(),
              source: "manual" as const,
            };
            setBusy(true);
            void onImport(
              supplier.id,
              [offer],
              buildSyncLog(supplier, { offers: [offer], skipped: 0 }, "manual", "manual"),
              mode,
            )
              .then(() => {
                toast.success("Позиция добавлена");
                setSku("");
                setName("");
              })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"))
              .finally(() => setBusy(false));
          }}
        >
          Добавить позицию
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
