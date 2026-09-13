"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OfferDrawer } from "@/components/offer-drawer";
import { BrandDialog, BrandMark } from "@/components/brand-mark";
import { PriceChange } from "@/components/price-change";
import { AddToOrderButtons, offerContextAdd } from "@/components/add-to-order";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, formatMoney, formatStock } from "@/lib/format";
import { applicabilityOf, sellWarning } from "@/lib/offer-extra";
import { pairLabel } from "@/lib/pairs";
import { PriceFormula } from "@/components/price-formula";
import { clientPriceBreakdown } from "@/lib/pricing";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function QuotePage() {
  const { ready, suppliers, clients, settings, addToDraft } = useAvtoPrice();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [inStock, setInStock] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false);
  const [live, setLive] = useState(false);
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [brandInfo, setBrandInfo] = useState<string | null>(null);

  const client = clients.find((item) => item.id === clientId);
  const names = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item.name])),
    [suppliers],
  );

  const load = useCallback(() => {
    const params = new URLSearchParams();
    const q = [sku, name].filter(Boolean).join(" ").trim();
    if (q) params.set("q", q);
    if (supplierId !== "all") params.set("supplierId", supplierId);
    if (brand !== "all") params.set("brand", brand);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (maxDays) params.set("maxDays", maxDays);
    if (inStock) params.set("inStock", "1");
    if (changedOnly) params.set("changed", "1");
    if (live) params.set("live", "1");
    params.set("page", String(page));
    params.set("pageSize", "40");
    setBusy(true);
    void fetch(`/api/catalog/browse?${params}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          offers?: Offer[];
          total?: number;
          brands?: { name: string; count: number }[];
        };
        setOffers(data.offers ?? []);
        setTotal(data.total ?? 0);
        if (data.brands?.length) setBrands(data.brands);
      })
      .finally(() => setBusy(false));
  }, [sku, name, supplierId, brand, minPrice, maxPrice, maxDays, inStock, changedOnly, live, page]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 40));

  if (!ready) return <p className="text-sm text-muted-foreground">Готовлю проценку…</p>;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Проценка</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Точечный поиск по прайсам поставщиков. ПКМ по строке — сразу в новый черновик заказа.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-6">
        <Input
          placeholder="Артикул / OEM"
          value={sku}
          onChange={(event) => {
            setSku(event.target.value);
            setPage(0);
          }}
        />
        <Input
          placeholder="Название"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setPage(0);
          }}
        />
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
            {suppliers.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
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
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Цена от"
          value={minPrice}
          onChange={(event) => {
            setMinPrice(event.target.value);
            setPage(0);
          }}
        />
        <Input
          placeholder="Цена до"
          value={maxPrice}
          onChange={(event) => {
            setMaxPrice(event.target.value);
            setPage(0);
          }}
        />
        <Input
          placeholder="Срок до, дн."
          value={maxDays}
          onChange={(event) => {
            setMaxDays(event.target.value);
            setPage(0);
          }}
        />
        <Select
          value={clientId || "none"}
          onValueChange={(value) => {
            if (value) setClientId(value === "none" ? "" : value);
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">
              {client ? client.name : "Клиент"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без клиента</SelectItem>
            {clients.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} · {item.discountPercent}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={inStock} onCheckedChange={(checked) => setInStock(checked === true)} />
          <Label className="font-normal">В наличии</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={changedOnly}
            onCheckedChange={(checked) => setChangedOnly(checked === true)}
          />
          <Label className="font-normal">Обновления цены</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={live} onCheckedChange={(checked) => setLive(checked === true)} />
          <Label className="font-normal">Живой Росско</Label>
        </label>
        <Button variant="outline" onClick={() => load()}>
          <Search />
          Искать
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {busy ? "Ищу…" : `${total.toLocaleString("ru-RU")} позиций`} · страница {page + 1}/{pages}
        {inStock ? " · только с остатком" : ""}
      </p>

      {offers.length === 0 && !busy ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          Позиций нет. Загрузите прайс в карточке поставщика или снимите фильтр «В наличии».
        </p>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Артикул</TableHead>
            <TableHead>Бренд</TableHead>
            <TableHead>Наименование</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead className="text-right">Закуп</TableHead>
            <TableHead className="text-right">Клиенту</TableHead>
            <TableHead className="hidden text-right md:table-cell">Срок</TableHead>
            <TableHead className="text-right">Ост.</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => {
            const breakdown = clientPriceBreakdown(
              offer.price,
              settings.priceBands,
              settings.markupPercent,
              client,
            );
            const sell = breakdown.sell;
            const warn = sellWarning(
              offer.price,
              settings.priceBands,
              settings.markupPercent,
              client,
            );
            const cars = applicabilityOf(offer);
            return (
              <TableRow
                key={offer.id}
                className="cursor-pointer"
                onClick={() => setSelected(offer)}
                onContextMenu={offerContextAdd(offer, addToDraft)}
              >
                <TableCell className="font-mono text-xs">
                  {offer.sku}
                  {offer.pairSide ? (
                    <p className="text-[10px] text-muted-foreground">{pairLabel(offer.pairSide)}</p>
                  ) : null}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <BrandMark brand={offer.brand} onOpen={(item) => setBrandInfo(item.name)} />
                </TableCell>
                <TableCell>
                  <p>{offer.name}</p>
                  {cars ? <p className="text-[11px] text-muted-foreground">{cars}</p> : null}
                  <PriceChange offer={offer} />
                </TableCell>
                <TableCell className="text-xs">{names.get(offer.supplierId)}</TableCell>
                <TableCell className="text-right">{formatMoney(offer.price, offer.currency)}</TableCell>
                <TableCell className={cn("text-right", warn && "text-amber-800")}>
                  {formatMoney(sell, offer.currency)}
                  <PriceFormula breakdown={breakdown} currency={offer.currency} compact />
                  {warn ? <p className="text-[10px] font-normal">ниже закупа</p> : null}
                </TableCell>
                <TableCell className="hidden text-right text-xs md:table-cell">
                  {formatDays(offer.deliveryDays)}
                </TableCell>
                <TableCell className="text-right">{formatStock(offer.stock)}</TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <AddToOrderButtons offer={offer} compact />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
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
        priceBands={settings.priceBands}
        onAdd={(item) => void addToDraft(item)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      <BrandDialog brand={brandInfo} onOpenChange={(open) => !open && setBrandInfo(null)} />
    </div>
  );
}
