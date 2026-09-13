"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatBandLabel, markupForPrice } from "@/lib/price-bands";
import { clientSellPrice, discountBreakEvenPercent } from "@/lib/pricing";
import type { Client, PriceBand } from "@/lib/types";

function emptyClient(): Client {
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    inn: "",
    discountPercent: 0,
    bandMarkups: {},
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

export default function ClientsPage() {
  const { ready, clients, settings, upsertClient, removeClient } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Client>(emptyClient());

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю клиентов…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Скидка и свои наценки по ценовым коридорам — отдельно для каждого клиента.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyClient());
            setOpen(true);
          }}
        >
          <Plus />
          Добавить клиента
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Клиентов нет. Добавьте розницу или СТО, чтобы считать цену со скидкой.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead className="hidden md:table-cell">Телефон</TableHead>
              <TableHead className="hidden lg:table-cell">ИНН</TableHead>
              <TableHead className="text-right">Скидка</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Коридоры</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => {
                      setDraft(client);
                      setOpen(true);
                    }}
                  >
                    {client.name}
                  </button>
                  {client.notes ? (
                    <p className="text-xs text-muted-foreground">{client.notes}</p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden md:table-cell">{client.phone || "—"}</TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {client.inn || "—"}
                </TableCell>
                <TableCell className="text-right">{client.discountPercent}%</TableCell>
                <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                  {Object.keys(client.bandMarkups ?? {}).length
                    ? `${Object.keys(client.bandMarkups ?? {}).length} своих`
                    : "как в настройках"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (confirm(`Удалить «${client.name}»?`)) void removeClient(client.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.createdAt && clients.some((item) => item.id === draft.id) ? "Клиент" : "Новый клиент"}</DialogTitle>
            <DialogDescription>
            Цена = закуп × (1 + наценка коридора) × (1 − скидка). Пустая наценка коридора — берётся из настроек.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Название">
              <Input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="СТО Север"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Телефон">
                <Input
                  value={draft.phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </Field>
              <Field label="ИНН">
                <Input
                  value={draft.inn}
                  onChange={(event) => setDraft((prev) => ({ ...prev, inn: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Скидка, % от цены с наценкой">
              <Input
                type="number"
                min={0}
                max={95}
                value={draft.discountPercent}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    discountPercent: Math.max(0, Number.parseFloat(event.target.value) || 0),
                  }))
                }
              />
              <DiscountHint
                discount={draft.discountPercent}
                bands={settings.priceBands}
                fallback={settings.markupPercent}
                client={draft}
              />
            </Field>
            <div className="grid gap-2">
              <Label>Наценки по ценовым категориям</Label>
              {settings.priceBands.map((band) => {
                const value = draft.bandMarkups?.[band.id];
                return (
                  <label key={band.id} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatBandLabel(band)} · база {band.markupPercent}%
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder={String(band.markupPercent)}
                      value={value ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setDraft((prev) => {
                          const next = { ...(prev.bandMarkups ?? {}) };
                          if (raw === "") delete next[band.id];
                          else next[band.id] = Number.parseFloat(raw) || 0;
                          return { ...prev, bandMarkups: next };
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <Field label="Комментарий">
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={draft.name.trim().length < 2}
              onClick={() => {
                const sample = clientSellPrice(1000, settings.priceBands, settings.markupPercent, {
                  ...draft,
                  name: draft.name.trim(),
                });
                void upsertClient({ ...draft, name: draft.name.trim() }).then(() => {
                  if (sample + 0.009 < 1000) {
                    toast.warning(
                      "Клиент сохранён. Скидка даёт цену ниже закупа — в проценке будет предупреждение, заказ не блокируется.",
                    );
                  } else {
                    toast.success("Клиент сохранён");
                  }
                  setOpen(false);
                });
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function DiscountHint({
  discount,
  bands,
  fallback,
  client,
}: {
  discount: number;
  bands: PriceBand[];
  fallback: number;
  client: Client;
}) {
  const sampleBuy = 1000;
  const markup = markupForPrice(sampleBuy, bands, fallback, client);
  const sell = clientSellPrice(sampleBuy, bands, fallback, client);
  const breakEven = discountBreakEvenPercent(markup);
  const below = sell + 0.009 < sampleBuy;
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">
        Цена клиенту = закуп + наценка коридора − скидка {discount || 0}%. Пример: закуп 1000 ₽, наценка{" "}
        {markup}% → клиенту {sell.toFixed(2)} ₽. Ниже закупа скидка становится после {breakEven}%.
      </p>
      {below ? (
        <p className="text-xs text-amber-800">
          Скидка опускает цену ниже закупа. Сохраним карточку — в проценке будет предупреждение, заказ не
          блокируется.
        </p>
      ) : null}
    </div>
  );
}
