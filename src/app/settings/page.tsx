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
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, maskKey } from "@/lib/format";
import type { Supplier } from "@/lib/types";

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
  const [busy, setBusy] = useState(false);

  const markupValue = markup ?? String(settings.markupPercent);
  const noteValue = hubNote ?? settings.moscowHubNote;

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
            Цена клиенту = закупочная × (1 + наценка) × (1 − скидка клиента).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>Наценка склада, %</Label>
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
          <div>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void saveTradeSettings({
                  markupPercent: Number.parseFloat(markupValue.replace(",", ".")) || 0,
                  moscowHubNote: noteValue,
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
