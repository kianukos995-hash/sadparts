"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OfferDrawer } from "@/components/offer-drawer";
import { OfferMedia } from "@/components/offer-media";
import { OfferSpecs } from "@/components/offer-specs";
import { BrandDialog, BrandMark } from "@/components/brand-mark";
import { PriceChange } from "@/components/price-change";
import { AddToOrderButtons, offerContextAdd } from "@/components/add-to-order";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, formatMoney, formatStock } from "@/lib/format";
import { groupByOem, offerTitle } from "@/lib/oem";
import { applicabilityOf, sellWarning } from "@/lib/offer-extra";
import { pairLabel } from "@/lib/pairs";
import { findBand, formatBandLabel } from "@/lib/price-bands";
import { PriceFormula } from "@/components/price-formula";
import { clientPriceBreakdown, clientSellPrice } from "@/lib/pricing";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export default function CatalogPage() {
  const { ready, suppliers, clients, settings, addToDraft } = useAvtoPrice();
  const [query, setQuery] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [total, setTotal] = useState(0);
  const [catalogRows, setCatalogRows] = useState(0);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);
  const [note, setNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [supplierId, setSupplierId] = useState("all");
  const [brand, setBrand] = useState("all");
  const [clientId, setClientId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [inStock, setInStock] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [brandInfo, setBrandInfo] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const client = clients.find((item) => item.id === clientId);
  const bands = settings.priceBands;

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (supplierId !== "all") params.set("supplierId", supplierId);
    if (brand !== "all") params.set("brand", brand);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (maxDays) params.set("maxDays", maxDays);
    if (inStock) params.set("inStock", "1");
    if (changedOnly) params.set("changed", "1");
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    setSearching(true);
    void fetch(`/api/catalog/browse?${params}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          offers?: Offer[];
          total?: number;
          catalogRows?: number;
          brands?: { name: string; count: number }[];
        };
        setOffers(data.offers ?? []);
        setTotal(data.total ?? 0);
        setCatalogRows(data.catalogRows ?? 0);
        if (data.brands?.length) setBrands(data.brands);
        setNote("");
      })
      .catch(() => setNote("Не удалось прочитать прайс"))
      .finally(() => setSearching(false));
  }, [query, supplierId, brand, maxPrice, maxDays, inStock, changedOnly, page]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const groups = useMemo(() => groupByOem(offers), [offers]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const names = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  if (!ready) return <p className="text-sm text-muted-foreground">Собираю каталог…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог запчастей</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Общий вид прайсов: фото, бренд, применимость, парные L/R, заметки. Точечный поиск — в
          проценке.
          {searching ? " Читаю прайс…" : ""}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Артикул, бренд, название, применимость"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={clientId || "none"}
          onValueChange={(value) => {
            if (value) setClientId(value === "none" ? "" : value);
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">
              {client ? `${client.name} · скидка ${client.discountPercent}%` : "Клиент для цены"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Розница / без клиента</SelectItem>
            {clients.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} · {item.discountPercent}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={supplierId}
          onValueChange={(value) => {
            if (value) {
              setSupplierId(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">
              {supplierId === "all"
                ? "Все поставщики"
                : (suppliers.find((item) => item.id === supplierId)?.name ?? "Поставщик")}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все поставщики</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={brand}
          onValueChange={(value) => {
            if (value) {
              setBrand(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">
              {brand === "all" ? "Все бренды" : brand}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бренды</SelectItem>
            {brands.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.name} · {item.count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Цена до, ₽"
          value={maxPrice}
          onChange={(event) => {
            setMaxPrice(event.target.value);
            setPage(0);
          }}
        />
        <Input
          placeholder="Срок до Москвы, дн."
          value={maxDays}
          onChange={(event) => {
            setMaxDays(event.target.value);
            setPage(0);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={inStock}
            onCheckedChange={(checked) => {
              setInStock(checked === true);
              setPage(0);
            }}
          />
          <Label className="font-normal">Только в наличии</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={changedOnly}
            onCheckedChange={(checked) => {
              setChangedOnly(checked === true);
              setPage(0);
            }}
          />
          <Label className="font-normal">Только обновлённые цены</Label>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {total.toLocaleString("ru-RU")} на странице фильтров · {catalogRows.toLocaleString("ru-RU")} в
        файлах прайсов · {groups.length} групп
        {note ? ` · ${note}` : ""}
      </p>

      {offers.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {catalogRows === 0
            ? "Прайс ещё не подхватился. Откройте Поставщики → загрузить файл."
            : "Нет позиций по этому фильтру."}
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => {
            const open = openGroups.has(group.key) || Boolean(query.trim()) || groups.length <= 8;
            const best = group.offers[0];
            const bestSell = clientSellPrice(best.price, bands, settings.markupPercent, client);
            return (
              <div key={group.key} className="overflow-hidden rounded-xl border">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => {
                    setOpenGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    });
                  }}
                >
                  <ChevronDown
                    className={cn("mt-1 size-4 shrink-0 text-muted-foreground", open && "rotate-180")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{group.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      OEM {group.oems.join(" · ") || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {group.brands.slice(0, 6).map((item) => (
                        <Badge key={item} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                      <Badge variant="outline">{group.offers.length} предл.</Badge>
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold">{formatMoney(bestSell)}</p>
                    <p className="text-xs text-muted-foreground">
                      клиенту · закуп от {formatMoney(group.minPrice)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      от {formatDays(group.minDays)} · {formatStock(group.stock)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border-t bg-muted/20">
                    {group.offers.map((offer) => {
                      const breakdown = clientPriceBreakdown(
                        offer.price,
                        bands,
                        settings.markupPercent,
                        client,
                      );
                      const sell = breakdown.sell;
                      const warn = sellWarning(
                        offer.price,
                        bands,
                        settings.markupPercent,
                        client,
                      );
                      const band = findBand(offer.price, bands);
                      const cars = applicabilityOf(offer);
                      return (
                        <div
                          key={offer.id}
                          className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start"
                          onContextMenu={offerContextAdd(offer, addToDraft)}
                        >
                          <div className="shrink-0">
                            <OfferMedia images={offer.images} sku={offer.sku} size="sm" />
                          </div>
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelected(offer)}
                          >
                            <p className="font-mono text-xs">{offer.sku}</p>
                            <div className="mt-0.5">
                              <BrandMark brand={offer.brand} onOpen={(item) => setBrandInfo(item.name)} />
                            </div>
                            <p className="text-sm">{offerTitle(offer)}</p>
                            <p className="text-xs text-muted-foreground">
                              {names.get(offer.supplierId)} · {formatStock(offer.stock)} ·{" "}
                              {formatDays(offer.deliveryDays)} до Москвы
                              {offer.pairSide ? ` · ${pairLabel(offer.pairSide)} сторона` : ""}
                            </p>
                            {cars ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">Применимость: {cars}</p>
                            ) : null}
                            {offer.notes ? (
                              <p className="text-[11px] text-amber-800">Заметка: {offer.notes}</p>
                            ) : null}
                            <PriceChange offer={offer} />
                            <OfferSpecs specs={offer.specs} compact />
                          </button>
                          <div className="flex flex-col items-stretch gap-2 sm:items-end">
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  warn ? "text-amber-800" : offer.id === best.id && "text-emerald-700",
                                )}
                              >
                                {formatMoney(sell, offer.currency)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                закуп {formatMoney(offer.price, offer.currency)} · {formatBandLabel(band)}
                              </p>
                              <PriceFormula
                                breakdown={breakdown}
                                currency={offer.currency}
                                compact
                              />
                              {warn ? (
                                <p className="text-[11px] text-amber-800">ниже закупа — только предупреждение</p>
                              ) : null}
                            </div>
                            <AddToOrderButtons offer={offer} compact />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Далее
          </Button>
        </div>
      ) : null}

      <OfferDrawer
        offer={selected}
        offers={offers}
        suppliers={suppliers}
        clients={clients}
        clientId={clientId}
        markupPercent={settings.markupPercent}
        priceBands={bands}
        onAdd={(item) => void addToDraft(item)}
        onOpenChange={(openState) => {
          if (!openState) setSelected(null);
        }}
      />
      <BrandDialog brand={brandInfo} onOpenChange={(open) => !open && setBrandInfo(null)} />
    </div>
  );
}
