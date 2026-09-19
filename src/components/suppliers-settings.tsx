"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SupplierFormDialog } from "@/components/supplier-form";
import { SupplierLogo } from "@/components/supplier-logo";
import { PriceListUpload } from "@/components/price-list-upload";
import { SupplierRequestPanel } from "@/components/supplier-request-panel";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { formatDays, maskKey } from "@/lib/format";
import {
  CUSTOM_API_ID,
  CUSTOM_EMAIL_ID,
  CUSTOM_FILE_ID,
  SUPPLIER_PRESETS,
  emptySupplierFromPreset,
  emailAliasFor,
  isSupplierConnected,
  presetById,
} from "@/lib/supplier-presets";
import { canCreateSupplier, canDeleteSupplier, canEditSupplier, canSeeSupplierCatalog } from "@/lib/suppliers-scope";
import type { Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SuppliersSettingsPanel() {
  const search = useSearchParams();
  const presetFromUrl = search.get("preset") ?? undefined;
  const requestPresetFromUrl = search.get("requestPreset") ?? undefined;
  const { user } = useAuth();
  const { suppliers, organizations, upsertSupplier, removeSupplier, refresh } = useAvtoPrice();
  const canSee = canSeeSupplierCatalog(user);
  const canCreate = canCreateSupplier(user);
  const [open, setOpen] = useState(Boolean(presetFromUrl) && canCreateSupplier(user));
  const [editing, setEditing] = useState<Supplier | undefined>();
  const [presetId, setPresetId] = useState<string | undefined>(canCreateSupplier(user) ? presetFromUrl : undefined);
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const requestPreset = requestPresetFromUrl || (!canCreate ? presetFromUrl : undefined);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SUPPLIER_PRESETS;
    return SUPPLIER_PRESETS.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle) ||
        item.aliases.some((alias) => alias.includes(needle)),
    );
  }, [query]);

  function openPreset(id: string) {
    setEditing(undefined);
    setPresetId(id);
    setOpen(true);
  }

  async function createNamedFile(file: File | undefined) {
    const name = fileName.trim() || (file ? file.name.replace(/\.[^.]+$/, "") : "");
    if (!name) {
      toast.error("Сначала дайте поставщику название");
      return;
    }
    if (!file) {
      toast.error("Выберите файл прайса");
      return;
    }
    setFileBusy(true);
    try {
      const created = emptySupplierFromPreset(presetById(CUSTOM_FILE_ID)!);
      created.name = name;
      created.code = name.slice(0, 8).toUpperCase().replace(/\s+/g, "");
      created.emailAlias = emailAliasFor(created.code || name);
      await upsertSupplier(created);
      const form = new FormData();
      form.set("action", "import");
      form.set("file", file);
      form.set("supplierId", created.id);
      form.set("mode", "replace");
      form.set("label", name);
      const response = await fetch("/api/catalog/import", { method: "POST", body: form });
      const data = (await response.json()) as { error?: string; imported?: number };
      if (!response.ok) throw new Error(data.error || "Не загрузить прайс");
      await refresh();
      toast.success(`«${name}»: ${(data.imported ?? 0).toLocaleString("ru-RU")} позиций`);
      setFileName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Файл не загрузился");
    } finally {
      setFileBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!canSee) {
    return (
      <p className="text-sm text-muted-foreground">
        Справочник поставщиков открыт администратору, организации и менеджеру.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Каталог поставщиков</CardTitle>
          <CardDescription>
            Логотип и имя как на витрине. После выбора — ключи API, файл или почта. Свой API остаётся
            отдельной карточкой.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <>
            <Button
              onClick={() => {
                setEditing(undefined);
                setPresetId(undefined);
                setOpen(true);
              }}
            >
              <Plus />
              Добавить поставщика
            </Button>
            <Button variant="outline" onClick={() => openPreset(CUSTOM_API_ID)}>
              Свой API
            </Button>
            <Button variant="outline" onClick={() => openPreset(CUSTOM_EMAIL_ID)}>
              На почту
            </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Карточки ниже — весь справочник. Нового поставщика не создаём: заполните запрос.
              </p>
            )}
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти в списке…" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((preset) => {
              const connected = suppliers.find(
                (item) => item.presetId === preset.id || item.code === preset.code || item.name === preset.name,
              );
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2 py-2 text-left hover:border-amber-400 hover:bg-amber-50/40",
                    connected && "border-amber-300 bg-amber-50/30",
                  )}
                  onClick={() => {
                    if (connected && canEditSupplier(connected, user, organizations)) {
                      setEditing(connected);
                      setPresetId(undefined);
                      setOpen(true);
                      return;
                    }
                    if (canCreate) {
                      openPreset(preset.id);
                      return;
                    }
                    const params = new URLSearchParams(search.toString());
                    params.set("tab", "suppliers");
                    params.set("requestPreset", preset.id);
                    window.history.replaceState(null, "", `/settings?${params.toString()}`);
                    toast.message(`Запрос на «${preset.name}» — заполните форму ниже`);
                  }}
                >
                  <SupplierLogo src={preset.logoUrl} name={preset.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{preset.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {connected ? (isSupplierConnected(connected) ? "подключён" : "добавлен") : "не подключён"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SupplierRequestPanel presetId={requestPreset} />

      {canCreate ? (
      <Card>
        <CardHeader>
          <CardTitle>Файл с названием</CardTitle>
          <CardDescription>
            Не из списка — просто имя и прайс. Появится в фильтре с этим названием.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            placeholder="Название поставщика, например «Склад Тума»"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xml,.zip,.json,.yml"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void createNamedFile(file);
            }}
          />
          <Button
            variant="outline"
            disabled={fileBusy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            {fileBusy ? "Загружаю…" : "Выбрать файл и создать"}
          </Button>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Подключённые</CardTitle>
          <CardDescription>Ключи, файлы и почтовые алиасы. Видны администратору, организации и менеджеру.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока никого нет — выберите карточку выше.</p>
          ) : (
            suppliers.map((supplier) => {
              const editable = canEditSupplier(supplier, user, organizations);
              const connected = isSupplierConnected(supplier);
              return (
                <div
                  key={supplier.id}
                  className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <SupplierLogo supplier={supplier} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/suppliers/${supplier.id}`} className="font-medium hover:underline">
                          {supplier.name}
                        </Link>
                        <Badge variant={connected ? "secondary" : "outline"}>
                          {connected ? "подключён" : "не подключён"}
                        </Badge>
                        <Badge variant="outline">
                          {supplier.source === "api" ? "API" : supplier.source === "email" ? "Почта" : "Файл"}
                        </Badge>
                        <Badge variant="outline">{formatDays(supplier.deliveryDaysMoscow)}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {editable
                          ? supplier.source === "api"
                            ? maskKey(supplier.apiKey)
                            : supplier.emailAlias || "без ключа"
                          : "ключи скрыты"}{" "}
                        · {supplier.catalogCount ?? supplier.lastSyncCount ?? 0} поз.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editable ? <PriceListUpload supplier={supplier} /> : null}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!editable}
                      onClick={() => {
                        setEditing(supplier);
                        setPresetId(undefined);
                        setOpen(true);
                      }}
                    >
                      Изменить
                    </Button>
                    {canDeleteSupplier(supplier, user, organizations) ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Удалить «${supplier.name}» и его прайс?`)) {
                            void removeSupplier(supplier.id);
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canCreate || editing ? (
      <SupplierFormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setEditing(undefined);
            setPresetId(undefined);
          }
        }}
        initial={editing}
        defaultPresetId={editing ? undefined : presetId}
        onSave={(supplier) => {
          void upsertSupplier(supplier).then(() => toast.success("Поставщик сохранён"));
        }}
      />
      ) : null}
    </div>
  );
}
