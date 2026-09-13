"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyField } from "@/components/key-field";
import { AUTH_MODE_LABELS, FIELD_LABELS } from "@/lib/constants";
import type { AuthMode, Supplier, SupplierSource } from "@/lib/types";
import { DEFAULT_COLUMN_MAP, FIELD_KEYS } from "@/lib/types";

function emptySupplier(): Supplier {
  return {
    id: crypto.randomUUID(),
    name: "",
    code: "",
    source: "api",
    adapter: "generic",
    apiUrl: "",
    apiKey: "",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    itemsPath: "items",
    columnMap: { ...DEFAULT_COLUMN_MAP },
    notes: "",
    active: true,
    createdAt: new Date().toISOString(),
    deliveryDaysMoscow: 2,
    deliveryNote: "",
  };
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supplier;
  onSave: (supplier: Supplier) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open ? (
          <SupplierFormFields
            key={initial?.id ?? "new"}
            initial={initial}
            onCancel={() => onOpenChange(false)}
            onSave={(supplier) => {
              onSave(supplier);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SupplierFormFields({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Supplier;
  onSave: (supplier: Supplier) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Supplier>(() =>
    initial ? { ...initial, columnMap: { ...initial.columnMap } } : emptySupplier(),
  );

  function update<K extends keyof Supplier>(key: K, value: Supplier[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const canSave =
    draft.name.trim().length > 1 && (draft.source === "file" || Boolean(draft.apiUrl.trim()));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? "Поставщик" : "Новый поставщик"}</DialogTitle>
        <DialogDescription>
          Ключ API уходит только на указанный URL поставщика при синхронизации прайса.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="main">
        <TabsList>
          <TabsTrigger value="main">Основные</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="delivery">Доставка</TabsTrigger>
          <TabsTrigger value="map">Поля прайса</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-4 grid gap-3">
          <Field label="Название">
            <Input
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Росско, Exist, локальный склад…"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Код">
              <Input
                value={draft.code}
                onChange={(event) => update("code", event.target.value.toUpperCase())}
                placeholder="ROSSKO"
              />
            </Field>
            <Field label="Источник">
              <Select
                value={draft.source}
                onValueChange={(value) => {
                  if (value) update("source", value as SupplierSource);
                }}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">
                    {draft.source === "file" ? "Только файл" : "API поставщика"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API поставщика</SelectItem>
                  <SelectItem value="file">Только файл</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Комментарий">
            <Textarea
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Как передаётся ключ, ограничения по складу, контакт менеджера"
              rows={3}
            />
          </Field>
        </TabsContent>

        <TabsContent value="api" className="mt-4 grid gap-3">
          <Field label="URL прайс-листа">
            <Input
              value={draft.apiUrl}
              onChange={(event) => update("apiUrl", event.target.value)}
              placeholder="https://api.supplier.ru/v1/prices"
              disabled={draft.source === "file"}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Авторизация">
              <Select
                value={draft.authMode}
                onValueChange={(value) => {
                  if (value) update("authMode", value as AuthMode);
                }}
                disabled={draft.source === "file"}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">
                    {AUTH_MODE_LABELS[draft.authMode]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUTH_MODE_LABELS) as AuthMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {AUTH_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {draft.authMode === "header" ? (
              <Field label="Имя заголовка">
                <Input
                  value={draft.authHeaderName}
                  onChange={(event) => update("authHeaderName", event.target.value)}
                />
              </Field>
            ) : (
              <Field label="Имя параметра URL">
                <Input
                  value={draft.authQueryParam}
                  onChange={(event) => update("authQueryParam", event.target.value)}
                  disabled={draft.authMode !== "query" || draft.source === "file"}
                />
              </Field>
            )}
          </div>
          <Field label="JSON-путь к позициям">
            <Input
              value={draft.itemsPath}
              onChange={(event) => update("itemsPath", event.target.value)}
              placeholder="items, data.products или пусто, если ответ — массив"
              disabled={draft.source === "file"}
            />
          </Field>
          <Field label="API-ключ">
            <KeyField value={draft.apiKey} onChange={(value) => update("apiKey", value)} />
          </Field>
        </TabsContent>

        <TabsContent value="delivery" className="mt-4 grid gap-3">
          <Field label="Срок до Москвы, дней">
            <Input
              type="number"
              min={0}
              value={draft.deliveryDaysMoscow}
              onChange={(event) =>
                update("deliveryDaysMoscow", Math.max(0, Number.parseInt(event.target.value, 10) || 0))
              }
            />
          </Field>
          <Field label="Комментарий по доставке">
            <Textarea
              value={draft.deliveryNote}
              onChange={(event) => update("deliveryNote", event.target.value)}
              placeholder="Склад, ТК, отсечка отгрузки, экспресс"
              rows={3}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Эти дни подставляются в позиции, если в прайсе нет своего срока. В заказе срок до Москвы
            берётся с предложения.
          </p>
        </TabsContent>

        <TabsContent value="map" className="mt-4 grid gap-3 sm:grid-cols-2">
          {FIELD_KEYS.map((field) => (
            <Field key={field} label={FIELD_LABELS[field]}>
              <Input
                value={draft.columnMap[field]}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    columnMap: { ...prev.columnMap, [field]: event.target.value },
                  }))
                }
                placeholder={DEFAULT_COLUMN_MAP[field]}
              />
            </Field>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Имена полей JSON или заголовки колонок файла. При загрузке CSV/XLSX колонки подставляются
            автоматически.
          </p>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          disabled={!canSave}
          onClick={() => {
            onSave({
              ...draft,
              name: draft.name.trim(),
              code: draft.code.trim() || draft.name.trim().slice(0, 8).toUpperCase(),
            });
          }}
        >
          Сохранить
        </Button>
      </DialogFooter>
    </>
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
