"use client";

import { useEffect, useState } from "react";
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
import { OfferSpecs } from "@/components/offer-specs";
import { OfferMedia } from "@/components/offer-media";
import { BrandDialog, BrandMark } from "@/components/brand-mark";
import { PriceChange } from "@/components/price-change";
import { AddToOrderButtons } from "@/components/add-to-order";
import { Textarea } from "@/components/ui/textarea";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDateTime, formatDays, formatMoney, formatStock } from "@/lib/format";
import { offerOems, offerTitle, relatedOffers } from "@/lib/oem";
import { applicabilityOf, relatedKind, sellWarning } from "@/lib/offer-extra";
import { pairLabel, pairQuery } from "@/lib/pairs";
import { PriceFormula } from "@/components/price-formula";
import { findBand, formatBandLabel, markupForPrice } from "@/lib/price-bands";
import { clientPriceBreakdown } from "@/lib/pricing";
import { useViewerPricing } from "@/hooks/use-viewer-pricing";
import type { Client, Offer, PriceBand, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OfferDrawer({
  offer,
  offers,
  suppliers,
  clients,
  clientId,
  orderId,
  markupPercent,
  priceBands,
  compact,
  onOpenChange,
}: {
  offer: Offer | null;
  offers: Offer[];
  suppliers: Supplier[];
  clients?: Client[];
  clientId?: string;
  orderId?: string;
  markupPercent: number;
  priceBands?: PriceBand[];
  compact?: boolean;
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
            clientId={clientId ?? ""}
            orderId={orderId}
            markupPercent={markupPercent}
            priceBands={priceBands ?? []}
            compact={Boolean(compact)}
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
  clientId: initialClientId,
  orderId,
  markupPercent,
  priceBands,
  compact,
  onOpenChange,
}: {
  offer: Offer;
  offers: Offer[];
  suppliers: Supplier[];
  clients: Client[];
  clientId: string;
  orderId?: string;
  markupPercent: number;
  priceBands: PriceBand[];
  compact?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { patchOffer } = useAvtoPrice();
  const viewer = useViewerPricing(initialClientId);
  const related = relatedOffers(offers, offer).sort(
    (a, b) => (a.sellPrice ?? a.price) - (b.sellPrice ?? b.price),
  );
  const minPrice = related[0]?.sellPrice ?? related[0]?.price;
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const [name, setName] = useState(offer.displayName ?? "");
  const [cross, setCross] = useState((offer.crossOems ?? []).join(", "));
  const [notes, setNotes] = useState(offer.notes ?? "");
  const [cars, setCars] = useState(applicabilityOf(offer));
  const [clientId, setClientId] = useState(viewer.locked ? viewer.clientId : initialClientId);
  const [brandOpen, setBrandOpen] = useState(false);
  const [pairHits, setPairHits] = useState<Offer[]>([]);
  const client = viewer.locked ? viewer.client : clients.find((item) => item.id === clientId);
  const bands = viewer.bands.length ? viewer.bands : priceBands;
  const band = findBand(offer.price, bands);
  const breakdown = clientPriceBreakdown(offer.price, bands, markupPercent, client);
  const sell = offer.sellPrice ?? (viewer.locked ? offer.price : breakdown.sell);
  const warn = viewer.showCost ? sellWarning(offer.costPrice ?? offer.price, bands, markupPercent, client) : "";
  const oems = offerOems(offer);
  const markup = markupForPrice(offer.price, bands, markupPercent, client);
  const pair = pairQuery(offer.sku, offer.name);

  useEffect(() => {
    if (!pair.sku && !pair.name) return;
    const q = pair.sku || pair.name;
    void fetch(`/api/catalog/browse?q=${encodeURIComponent(q)}&pageSize=8`)
      .then(async (response) => {
        const data = (await response.json()) as { offers?: Offer[] };
        setPairHits((data.offers ?? []).filter((item) => item.id !== offer.id).slice(0, 6));
      })
      .catch(() => setPairHits([]));
  }, [offer.id, pair.sku, pair.name]);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{offerTitle(offer)}</SheetTitle>
        <SheetDescription>
          {offer.brand} · {offer.sku}
          {oems.length ? ` · OEM ${oems.join(" / ")}` : ""}
          {offer.pairSide ? ` · ${pairLabel(offer.pairSide)}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <BrandMark brand={offer.brand} onOpen={() => setBrandOpen(true)} />
          <Badge variant="secondary">{offer.category}</Badge>
          {viewer.locked ? (
            <Badge variant="outline">срок {formatDays(offer.deliveryDays)}</Badge>
          ) : (
            <Badge variant="outline">{names.get(offer.supplierId)}</Badge>
          )}
          <Badge variant="outline">{formatBandLabel(band)}</Badge>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {formatMoney(sell, offer.currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            {viewer.showCost
              ? `Коридор ${formatBandLabel(band)} · наценка ${markup}%${client?.discountPercent ? ` · скидка ${client.discountPercent}%` : " · без скидки"}`
              : viewer.view === "retail"
                ? "Розница минус ваша скидка"
                : "Цена с рыночной наценкой"}
          </p>
          {viewer.view !== "clean" && !viewer.locked ? (
          <PriceFormula
            breakdown={breakdown}
            currency={offer.currency}
            compact
            className="mt-1"
            view={viewer.view}
          />
          ) : null}
          {warn && viewer.showCost ? <p className="mt-1 text-xs text-amber-800">{warn}</p> : null}
          {viewer.showCost ? <PriceChange offer={offer} /> : null}
        </div>
        <OfferMedia images={offer.images} sku={offer.sku} size="lg" />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Остаток" value={formatStock(offer.stock)} />
          <Info label="Склад" value={viewer.locked ? "склад" : offer.warehouse || "—"} />
          <Info label="Срок поставки" value={formatDays(offer.deliveryDays)} />
          <Info label="Обновлено" value={formatDateTime(offer.updatedAt)} />
        </dl>

        <OfferSpecs specs={offer.specs} defaultOpen />

        {!viewer.locked && clients.length > 0 ? (
          <label className="grid gap-1.5 text-sm">
            <Label>Клиент для расчёта</Label>
            <select
              className="h-9 rounded-lg border bg-transparent px-3 text-sm"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">Розница / без клиента</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · скидка {item.discountPercent}%
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {viewer.showAdminCost && !compact && !viewer.locked ? (
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
          <label className="grid gap-1.5">
            <Label>Применимость (марки / модели)</Label>
            <Input
              value={cars}
              onChange={(event) => setCars(event.target.value)}
              placeholder="Audi A4 2008–2015, VW Passat B6"
            />
          </label>
          <label className="grid gap-1.5">
            <Label>Заметка к позиции</Label>
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <Button
            variant="outline"
            onClick={() => {
              void patchOffer(
                offer.id,
                {
                  displayName: name,
                  notes,
                  applicability: cars,
                  crossOems: cross
                    .split(/[;,]/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
                offer.supplierId,
              ).then(() => toast.success("Позиция сохранена в прайсе"));
            }}
          >
            Сохранить название, кроссы, заметки
          </Button>
        </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-sm font-medium">
            {viewer.locked ? "Аналоги и сроки" : "Аналоги и предложения"}
          </h3>
          <div className="flex flex-col gap-2">
            {related.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2",
                  (item.sellPrice ?? item.price) === minPrice && "border-emerald-300 bg-emerald-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium">
                    {viewer.locked
                      ? `Срок ${formatDays(item.deliveryDays)}`
                      : names.get(item.supplierId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand} {item.sku}
                    {viewer.locked
                      ? ` · наличие ${formatStock(item.stock)}`
                      : ` · склад ${item.warehouse || "не указан"} · ${formatStock(item.stock)} · ${formatDays(item.deliveryDays)} с этого склада`}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatMoney(item.sellPrice ?? item.price, item.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {pairHits.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium">Пара и уплотнения</h3>
            <div className="flex flex-col gap-2">
              {pairHits.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {item.brand} {item.sku}
                      {relatedKind(item, offer) ? ` · ${relatedKind(item, offer)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                  </div>
                  <p className="text-sm">{formatMoney(item.sellPrice ?? item.price, item.currency)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <AddToOrderButtons offer={offer} clientId={clientId} orderId={orderId} />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </div>
      <BrandDialog brand={brandOpen ? offer.brand : null} onOpenChange={(open) => setBrandOpen(open)} />
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
