"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDateTime, formatDays, formatMoney, formatStock } from "@/lib/format";
import { offerOems, offerTitle, relatedOffers } from "@/lib/oem";
import { sellUnitPrice } from "@/lib/pricing";
import type { Client, Offer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OfferDrawer({
  offer,
  offers,
  suppliers,
  clients,
  markupPercent,
  onAdd,
  onOpenChange,
}: {
  offer: Offer | null;
  offers: Offer[];
  suppliers: Supplier[];
  clients?: Client[];
  markupPercent: number;
  onAdd?: (offer: Offer) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(offer)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {offer ? (
          <DrawerBody
            key={offer.id}
            offer={offer}
            offers={offers}
            suppliers={suppliers}
            clients={clients ?? []}
            markupPercent={markupPercent}
            onAdd={onAdd}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  offer,
  offers,
  suppliers,
  clients,
  markupPercent,
  onAdd,
  onOpenChange,
}: {
  offer: Offer;
  offers: Offer[];
  suppliers: Supplier[];
  clients: Client[];
  markupPercent: number;
  onAdd?: (offer: Offer) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { patchOffer } = useAvtoPrice();
  const related = relatedOffers(offers, offer).sort((a, b) => a.price - b.price);
  const minPrice = related[0]?.price;
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const [name, setName] = useState(offer.displayName ?? "");
  const [cross, setCross] = useState((offer.crossOems ?? []).join(", "));
  const [clientId, setClientId] = useState("");
  const client = clients.find((item) => item.id === clientId);
  const discount = client?.discountPercent ?? 0;
  const sell = sellUnitPrice(offer.price, markupPercent, discount);
  const oems = offerOems(offer);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{offerTitle(offer)}</SheetTitle>
        <SheetDescription>
          {offer.brand} · {offer.sku}
          {oems.length ? ` · OEM ${oems.join(" / ")}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{offer.category}</Badge>
          <Badge variant="outline">{names.get(offer.supplierId)}</Badge>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {formatMoney(offer.price, offer.currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            С наценкой {markupPercent}%
            {discount ? ` и скидкой клиента ${discount}%` : ""}:{" "}
            <span className="font-medium text-foreground">
              {formatMoney(sell, offer.currency)}
            </span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Остаток" value={formatStock(offer.stock)} />
          <Info label="Склад" value={offer.warehouse || "—"} />
          <Info label="До Москвы" value={formatDays(offer.deliveryDays)} />
          <Info label="Обновлено" value={formatDateTime(offer.updatedAt)} />
        </dl>

        {clients.length > 0 ? (
          <label className="grid gap-1.5 text-sm">
            <Label>Клиент для расчёта</Label>
            <select
              className="h-9 rounded-lg border bg-transparent px-3 text-sm"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">Без скидки</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.discountPercent}%
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Карточка как в Автодилере</p>
          <label className="grid gap-1.5">
            <Label>Наименование для заказа</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={offer.name} />
          </label>
          <label className="grid gap-1.5">
            <Label>Кросс-OEM</Label>
            <Input
              value={cross}
              onChange={(event) => setCross(event.target.value)}
              placeholder="4E0698151B, 4E0615301E"
            />
          </label>
          <Button
            variant="outline"
            onClick={() => {
              void patchOffer(offer.id, {
                displayName: name,
                crossOems: cross
                  .split(/[;,]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              }).then(() => toast.success("Позиция обновлена"));
            }}
          >
            Сохранить название и кроссы
          </Button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Аналоги и предложения</h3>
          <div className="flex flex-col gap-2">
            {related.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2",
                  item.price === minPrice && "border-emerald-300 bg-emerald-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{names.get(item.supplierId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand} {item.sku} · {formatStock(item.stock)} · {formatDays(item.deliveryDays)}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(item.price, item.currency)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {onAdd ? (
            <Button
              onClick={() => {
                onAdd(offer);
                onOpenChange(false);
              }}
            >
              В заказ
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
