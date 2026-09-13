"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SupplierFormDialog } from "@/components/supplier-form";
import { PriceBandsEditor } from "@/components/price-bands-editor";
import { PriceFormula } from "@/components/price-formula";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, maskKey } from "@/lib/format";
import { DEFAULT_PRICE_BANDS, markupForPrice, sanitizeBands } from "@/lib/price-bands";
import { priceBreakdown } from "@/lib/pricing";
import type { PriceBand, Supplier } from "@/lib/types";

export default function SettingsPage() {
  const {
    ready,
    suppliers,
    settings,
    upsertSupplier,
    removeSupplier,
    saveTradeSettings,
  } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>();
  const [markup, setMarkup] = useState<string | null>(null);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const [bands, setBands] = useState<PriceBand[] | null>(null);
  const [sellerTitle, setSellerTitle] = useState<string | null>(null);
  const [sellerAddress, setSellerAddress] = useState<string | null>(null);
  const [vat, setVat] = useState<string | null>(null);
  const [notifyChat, setNotifyChat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const markupValue = markup ?? String(settings.markupPercent);
  const noteValue = hubNote ?? settings.moscowHubNote;
  const bandsValue = bands ?? sanitizeBands(settings.priceBands?.length ? settings.priceBands : DEFAULT_PRICE_BANDS);
  const sampleBuy = 1000;
  const sampleMarkup = markupForPrice(
    sampleBuy,
    bandsValue,
    Number.parseFloat(markupValue.replace(",", ".")) || 0,
  );
  const sampleBreakdown = priceBreakdown(sampleBuy, sampleMarkup, 8);
  const sellerTitleValue = sellerTitle ?? settings.sellerTitle ?? "";
  const sellerAddressValue = sellerAddress ?? settings.sellerAddress ?? "";
  const vatValue = vat ?? String(settings.vatPercent ?? 0);
  const notifyChatValue = notifyChat ?? settings.telegramNotifyChatId ?? "";

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю настройки…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Наценка склада, срок до Москвы и ключи API поставщиков.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <KeyRound />
          Добавить ключ API
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Торговля</CardTitle>
          <CardDescription>
            Цена клиенту = закуп + наценка по категории − скидка клиента. Наценка от закупа, скидка от
            цены с наценкой. Пример: 1000 ₽, коридор 16%, скидка 8% → 1000 + 160 − 92,80 = 1067,20 ₽.
            Коридоры можно переопределить в карточке клиента. Наценка 0% — это 0%, а не подмена на
            значение по умолчанию.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>Наценка по умолчанию, %</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={markupValue}
              onChange={(event) => setMarkup(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Комментарий по доставке до Москвы</Label>
            <Textarea
              rows={3}
              value={noteValue}
              onChange={(event) => setHubNote(event.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Ценовые категории</Label>
            <PriceBandsEditor bands={bandsValue} onChange={setBands} />
            <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Пример на закуп {sampleBuy} ₽ и скидку клиента 8%. Коридор даёт наценку {sampleMarkup}%.
              </p>
              <PriceFormula breakdown={sampleBreakdown} className="mt-1" />
            </div>
          </div>
          <div>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void saveTradeSettings({
                  markupPercent: Number.parseFloat(markupValue.replace(",", ".")) || 0,
                  moscowHubNote: noteValue,
                  priceBands: bandsValue,
                  sellerTitle: sellerTitleValue,
                  sellerAddress: sellerAddressValue,
                  vatPercent: Number.parseFloat(vatValue.replace(",", ".")) || 0,
                  telegramNotifyChatId: notifyChatValue,
                })
                  .then(() => toast.success("Настройки сохранены"))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Ошибка"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Накладная ЗК</CardTitle>
          <CardDescription>
            Шапка Excel и печати берётся отсюда. Шаблон — «Заказ клиента ЗК-500». Номера заказов:
            ЗК-0001, ЗК-0002…
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Продавец (строка 1)</Label>
            <Input value={sellerTitleValue} onChange={(event) => setSellerTitle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Адрес (строка 2)</Label>
            <Textarea
              rows={2}
              value={sellerAddressValue}
              onChange={(event) => setSellerAddress(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <Label>НДС, % (0 — не облагается)</Label>
            <Input value={vatValue} onChange={(event) => setVat(event.target.value)} type="number" min={0} />
          </label>
          <label className="grid gap-1.5">
            <Label>Chat ID для накладных в Telegram</Label>
            <Input
              value={notifyChatValue}
              onChange={(event) => setNotifyChat(event.target.value)}
              placeholder="если у клиента нет своего"
              list="telegram-chats"
            />
            <datalist id="telegram-chats">
              {settings.telegramChats?.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title}
                </option>
              ))}
            </datalist>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поставщики и API</CardTitle>
          <CardDescription>
            Добавляйте, правите и удаляйте источники. В карточке ключа укажите срок до Москвы.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Поставщиков нет.</p>
          ) : (
            suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{supplier.name}</p>
                    <Badge variant="secondary">{supplier.source === "api" ? "API" : "Файл"}</Badge>
                    <Badge variant="outline">{formatDays(supplier.deliveryDaysMoscow)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {supplier.source === "api" ? maskKey(supplier.apiKey) : "без ключа"} ·{" "}
                    {supplier.deliveryNote || "комментарий по доставке не задан"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(supplier);
                      setOpen(true);
                    }}
                  >
                    Изменить
                  </Button>
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
                </div>
              </div>
            ))
          )}
          <Button
            variant="outline"
            className="mt-2 w-fit"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus />
            Новый поставщик
          </Button>
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={(supplier) => {
          upsertSupplier(supplier).then(() => toast.success("Поставщик сохранён"));
        }}
      />
    </div>
  );
}
