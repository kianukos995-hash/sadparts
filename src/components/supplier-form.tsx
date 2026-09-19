"use client";

import { useMemo, useState } from "react";
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
import { SupplierLogo } from "@/components/supplier-logo";
import { AUTH_MODE_LABELS, ADAPTER_LABELS, FIELD_LABELS, ROSSKO_API_BASE } from "@/lib/constants";
import {
  ALL_PRESETS,
  API_KIND_HINTS,
  API_KIND_LABELS,
  CUSTOM_API_ID,
  CUSTOM_EMAIL_ID,
  CUSTOM_FILE_ID,
  emptySupplierFromPreset,
  emailAliasFor,
  presetById,
  type SupplierApiKind,
  type SupplierPreset,
} from "@/lib/supplier-presets";
import type { AdapterKind, AuthMode, Supplier, SupplierSource } from "@/lib/types";
import { DEFAULT_COLUMN_MAP, FIELD_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";

function emptySupplier(source: SupplierSource = "api"): Supplier {
  const presetId = source === "file" ? CUSTOM_FILE_ID : source === "email" ? CUSTOM_EMAIL_ID : CUSTOM_API_ID;
  return emptySupplierFromPreset(presetById(presetId)!);
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  initial,
  defaultSource = "api",
  defaultPresetId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supplier;
  defaultSource?: SupplierSource;
  defaultPresetId?: string;
  onSave: (supplier: Supplier) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {open ? (
          <SupplierFormFields
            key={initial?.id ?? `new-${defaultSource}-${defaultPresetId ?? ""}`}
            initial={initial}
            defaultSource={defaultSource}
            defaultPresetId={defaultPresetId}
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
  defaultSource = "api",
  defaultPresetId,
  onSave,
  onCancel,
}: {
  initial?: Supplier;
  defaultSource?: SupplierSource;
  defaultPresetId?: string;
  onSave: (supplier: Supplier) => void;
  onCancel: () => void;
}) {
  const startPreset = defaultPresetId ? presetById(defaultPresetId) : undefined;
  const [step, setStep] = useState<"pick" | "form">(initial || startPreset ? "form" : "pick");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Supplier>(() => {
    if (initial) return { ...initial, columnMap: { ...initial.columnMap } };
    if (startPreset) return emptySupplierFromPreset(startPreset);
    return emptySupplier(defaultSource);
  });

  function update<K extends keyof Supplier>(key: K, value: Supplier[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: SupplierPreset) {
    const next = emptySupplierFromPreset(preset);
    if (initial) {
      next.id = initial.id;
      next.createdAt = initial.createdAt;
      next.ownerRole = initial.ownerRole;
      next.ownerId = initial.ownerId;
      next.lockedByAdmin = initial.lockedByAdmin;
      next.sharedWithOrgIds = initial.sharedWithOrgIds;
    }
    setDraft(next);
    setStep("form");
  }

  const rossko = draft.adapter === "rossko" || draft.apiKind === "rossko-soap";
  const fileOnly = draft.source === "file" || draft.source === "email" || draft.apiKind === "file" || draft.apiKind === "email";
  const canSave =
    draft.name.trim().length > 1 &&
    (fileOnly || rossko || Boolean(draft.apiUrl.trim()));

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = ALL_PRESETS;
    if (!needle) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle) ||
        item.aliases.some((alias) => alias.includes(needle)),
    );
  }, [query]);

  if (step === "pick") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Кого подключаем</DialogTitle>
          <DialogDescription>
            Выберите поставщика из списка — логотип и название совпадут. Либо свой API, файл с именем
            или приём прайса на почту.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти: ARMTEK, Autodoc, файл…"
        />
        <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {shown.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="flex items-center gap-2 rounded-xl border bg-background px-2 py-2 text-left hover:border-amber-400 hover:bg-amber-50/50"
              onClick={() => applyPreset(preset)}
            >
              <SupplierLogo src={preset.logoUrl} name={preset.name} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{preset.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {API_KIND_LABELS[preset.apiKind]}
                </span>
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        </DialogFooter>
      </>
    );
  }

  const kind = (draft.apiKind || (rossko ? "rossko-soap" : fileOnly ? "file" : "generic-json")) as SupplierApiKind;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <SupplierLogo supplier={draft} />
          {initial ? "Поставщик" : draft.name || "Новый поставщик"}
        </DialogTitle>
        <DialogDescription>
          {API_KIND_HINTS[kind]}
          {kind === "generic-json" || kind === "bearer" || kind === "header" || kind === "query" || kind === "two-key"
            ? " Ключ уходит только на указанный URL."
            : ""}
        </DialogDescription>
      </DialogHeader>

      {!initial ? (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setStep("pick")}>
          ← Другой поставщик из списка
        </Button>
      ) : null}

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
              placeholder="Как будет в фильтре и на карточке"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Код">
              <Input
                value={draft.code}
                onChange={(event) => update("code", event.target.value.toUpperCase())}
                placeholder="ARMTEK"
              />
            </Field>
            <Field label="Как приходит прайс">
              <Select
                value={draft.source === "email" ? "email" : draft.source === "file" ? "file" : "api"}
                onValueChange={(value) => {
                  if (!value) return;
                  const source = value as SupplierSource;
                  setDraft((prev) => ({
                    ...prev,
                    source,
                    apiKind:
                      source === "email"
                        ? "email"
                        : source === "file"
                          ? prev.apiKind === "email"
                            ? "file"
                            : prev.apiKind || "file"
                          : prev.apiKind === "file" || prev.apiKind === "email"
                            ? "generic-json"
                            : prev.apiKind,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">
                    {draft.source === "email"
                      ? "Письмо на почту"
                      : draft.source === "file"
                        ? "Файл с названием"
                        : "API поставщика"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API поставщика</SelectItem>
                  <SelectItem value="file">Файл с названием</SelectItem>
                  <SelectItem value="email">Письмо на почту</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Адрес для прайса">
            <Input
              value={draft.emailAlias ?? ""}
              onChange={(event) => update("emailAlias", event.target.value.toLowerCase())}
              placeholder={emailAliasFor(draft.code || "armtek")}
            />
            <p className="text-xs text-muted-foreground">
              Плюс-алиас закреплённого ящика <code>prajsy@sadparts.ru</code>. Поставщик шлёт сюда —
              письмо само попадает в его прайс.
            </p>
          </Field>
          <Field label="Тип API">
            <Select
              value={kind}
              onValueChange={(value) => {
                if (!value) return;
                const apiKind = value as SupplierApiKind;
                setDraft((prev) => ({
                  ...prev,
                  apiKind,
                  adapter: apiKind === "rossko-soap" ? "rossko" : prev.adapter === "rossko" ? "generic" : prev.adapter,
                  source: apiKind === "email" ? "email" : apiKind === "file" ? "file" : prev.source === "email" || prev.source === "file" ? "api" : prev.source,
                  apiUrl: apiKind === "rossko-soap" ? ROSSKO_API_BASE : prev.apiUrl,
                  authMode:
                    apiKind === "bearer" ? "bearer" : apiKind === "query" ? "query" : apiKind === "header" || apiKind === "two-key" ? "header" : prev.authMode,
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">{API_KIND_LABELS[kind]}</span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(API_KIND_LABELS) as SupplierApiKind[]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {API_KIND_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className={cn("text-xs text-muted-foreground")}>{API_KIND_HINTS[kind]}</p>
          {draft.source === "api" ? (
            <Field label="Коннектор">
              <Select
                value={draft.adapter === "demo" ? "generic" : draft.adapter}
                onValueChange={(value) => {
                  if (!value) return;
                  const adapter = value as AdapterKind;
                  setDraft((prev) => ({
                    ...prev,
                    adapter,
                    apiKind: adapter === "rossko" ? "rossko-soap" : prev.apiKind === "rossko-soap" ? "generic-json" : prev.apiKind,
                    apiUrl: adapter === "rossko" ? ROSSKO_API_BASE : prev.apiUrl,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">
                    {ADAPTER_LABELS[draft.adapter === "demo" ? "generic" : draft.adapter]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">{ADAPTER_LABELS.generic}</SelectItem>
                  <SelectItem value="rossko">{ADAPTER_LABELS.rossko}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
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
          <Field label={rossko ? "Базовый URL SOAP v2.1" : "URL прайс-листа"}>
            <Input
              value={draft.apiUrl}
              onChange={(event) => update("apiUrl", event.target.value)}
              placeholder={rossko ? ROSSKO_API_BASE : "https://api.supplier.ru/v1/prices"}
              disabled={fileOnly && !rossko}
            />
          </Field>
          {rossko ? (
            <>
              <Field label="KEY1">
                <KeyField
                  value={draft.apiKey}
                  onChange={(value) => update("apiKey", value)}
                  placeholder="Первый секретный ключ"
                />
              </Field>
              <Field label="KEY2">
                <KeyField
                  value={draft.apiKey2}
                  onChange={(value) => update("apiKey2", value)}
                  placeholder="Второй секретный ключ"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="delivery_id (из GetCheckoutDetails)">
                  <Input
                    value={draft.rosskoDeliveryId ?? ""}
                    onChange={(event) => update("rosskoDeliveryId", event.target.value)}
                    placeholder="подставится при проверке ключей"
                  />
                </Field>
                <Field label="address_id">
                  <Input
                    value={draft.rosskoAddressId ?? ""}
                    onChange={(event) => update("rosskoAddressId", event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                GetSearch ищет по артикулу, названию или GUID. Полный прайс (ZIP/CSV Росско) грузите
                в «Прайсы» — это ~190 тыс. строк, они не едут в браузер целиком.
              </p>
            </>
          ) : (
            <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Авторизация">
              <Select
                value={draft.authMode}
                onValueChange={(value) => {
                  if (value) update("authMode", value as AuthMode);
                }}
                disabled={fileOnly}
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
                  disabled={draft.authMode !== "query" || fileOnly}
                />
              </Field>
            )}
          </div>
          <Field label="JSON-путь к позициям">
            <Input
              value={draft.itemsPath}
              onChange={(event) => update("itemsPath", event.target.value)}
              placeholder="items, data.products или пусто, если ответ — массив"
              disabled={fileOnly}
            />
          </Field>
          <Field label={kind === "two-key" ? "KEY1 / логин" : "API-ключ / KEY1"}>
            <KeyField value={draft.apiKey} onChange={(value) => update("apiKey", value)} />
          </Field>
          <Field label={kind === "two-key" ? "KEY2 / пароль" : "KEY2 (если поставщик отдаёт второй ключ)"}>
            <KeyField
              value={draft.apiKey2}
              onChange={(value) => update("apiKey2", value)}
              placeholder="Второй ключ, пароль или secret"
            />
          </Field>
            </>
          )}
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
            Имена полей JSON или заголовки колонок файла: артикул, бренд, наименование, OEM, категория,
            цена, валюта, остаток, склад, кратность, срок. При загрузке файла сохранённые ключи имеют
            приоритет, остальные колонки угадываются.
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
            const name = draft.name.trim();
            const code = draft.code.trim() || name.slice(0, 8).toUpperCase();
            onSave({
              ...draft,
              name,
              code,
              emailAlias: (draft.emailAlias || emailAliasFor(code)).trim(),
              apiUrl: draft.adapter === "rossko" ? draft.apiUrl.trim() || ROSSKO_API_BASE : draft.apiUrl,
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
