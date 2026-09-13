"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ClientCartBar } from "@/components/client-carts";
import { SearchPick } from "@/components/search-pick";
import { SortToggle, type SortDir } from "@/components/sort-toggle";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, formatMoney, formatStock } from "@/lib/format";
import { findDraftForClient } from "@/lib/order";
import { applicabilityOf, sellWarning } from "@/lib/offer-extra";
import { pairLabel } from "@/lib/pairs";
import { PriceFormula } from "@/components/price-formula";
import { clientPriceBreakdown } from "@/lib/pricing";
import { sortOffers } from "@/lib/sort-offers";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";

function QuotePageInner() {
  const searchParams = useSearchParams();
  const { ready, suppliers, clients, settings, addToDraft, drafts, orders, setActiveDraftId } =
    useAvtoPrice();
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
  const [orderId, setOrderId] = useState("");
  const [page, setPage] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [brandInfo, setBrandInfo] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deliverySort, setDeliverySort] = useState<SortDir>("asc");
  const [priceSort, setPriceSort] = useState<SortDir>("");

  const client = clients.find((item) => item.id === clientId);
  const targetOrder = orders.find((item) => item.id === orderId) ?? null;
  const names = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item.name])),
    [suppliers],
  );

  useEffect(() => {
    const fromClient = searchParams.get("clientId") ?? "";
    const fromOrder = searchParams.get("orderId") ?? "";
    if (fromClient) setClientId(fromClient);
    if (fromOrder) {
      setOrderId(fromOrder);
      setActiveDraftId(fromOrder);
    }
  }, [searchParams, setActiveDraftId]);

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

  const displayed = useMemo(
    () => sortOffers(offers, deliverySort, priceSort),
    [offers, deliverySort, priceSort],
  );
  const pages = Math.max(1, Math.ceil(total / 40));
  const extraFilterCount = [
    supplierId !== "all",
    brand !== "all",
    minPrice,
    maxPrice,
    maxDays,
    inStock,
    changedOnly,
    live,
    priceSort,
  ].filter(Boolean).length;

  if (!ready) return <p className="text-sm text-muted-foreground">Готовлю проценку…</p>;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Проценка</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Поиск по клиенту, бренду и поставщику. Срок — стрелками от быстрых к долгим. Доп. фильтры
          скрыты за кнопкой.
        </p>
      </div>

      {targetOrder ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span>
            Добавление в {targetOrder.status === "draft" ? "корзину" : "заказ"}{" "}
            <span className="font-mono font-semibold">{targetOrder.number}</span>
            {client ? ` · ${client.name}` : ""}
          </span>
          <Link
            href={
              targetOrder.status === "draft"
                ? `/cart?id=${targetOrder.id}`
                : `/orders/${targetOrder.id}`
            }
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Вернуться
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-end">
          <Input
            placeholder="Артикул / OEM"
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
              setPage(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") load();
            }}
          />
          <Input
            placeholder="Название"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setPage(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") load();
            }}
          />
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Клиент</Label>
            <SearchPick
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                if (id) {
                  const existing = findDraftForClient(drafts, id);
                  if (existing) setActiveDraftId(existing.id);
                }
              }}
              placeholder="Найти клиента…"
              emptyLabel="Все клиенты"
              options={clients.map((item) => ({
                id: item.id,
                label: `${item.name} · ${item.discountPercent}%`,
              }))}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <SortToggle
              label="Срок"
              value={deliverySort}
              onChange={setDeliverySort}
              ascTitle="Сначала быстрые"
              descTitle="Сначала долгие"
            />
            <Button
              type="button"
              variant={filtersOpen || extraFilterCount ? "default" : "outline"}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter />
              Фильтры
              {extraFilterCount ? (
                <span className="rounded-full bg-background/20 px-1.5 text-[11px]">
                  {extraFilterCount}
                </span>
              ) : null}
              <ChevronDown className={cn("size-4 transition", filtersOpen && "rotate-180")} />
            </Button>
            <Button type="button" onClick={() => load()}>
              <Search />
              Искать
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="grid gap-3 rounded-lg border border-dashed bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Поставщик</Label>
              <SearchPick
                value={supplierId === "all" ? "" : supplierId}
                onChange={(id) => {
                  setSupplierId(id || "all");
                  setPage(0);
                }}
                placeholder="Найти поставщика…"
                emptyLabel="Все поставщики"
                options={suppliers.map((item) => ({ id: item.id, label: item.name }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Бренд</Label>
              <SearchPick
                value={brand === "all" ? "" : brand}
                onChange={(id) => {
                  setBrand(id || "all");
                  setPage(0);
                }}
                placeholder="Найти бренд…"
                emptyLabel="Все бренды"
                options={brands.map((item) => ({
                  id: item.name,
                  label: `${item.name} · ${item.count}`,
                }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Цена</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="от"
                  inputMode="decimal"
                  value={minPrice}
                  onChange={(event) => {
                    setMinPrice(event.target.value);
                    setPage(0);
                  }}
                />
                <Input
                  placeholder="до"
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(event) => {
                    setMaxPrice(event.target.value);
                    setPage(0);
                  }}
                />
                <SortToggle
                  value={priceSort}
                  onChange={setPriceSort}
                  ascTitle="От меньшей"
                  descTitle="От большей"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Input
                placeholder="Срок до, дн."
                value={maxDays}
                onChange={(event) => {
                  setMaxDays(event.target.value);
                  setPage(0);
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={inStock}
                  onCheckedChange={(checked) => setInStock(checked === true)}
                />
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
            </div>
          </div>
        ) : null}
      </div>

      <ClientCartBar clientId={clientId} onClientId={setClientId} onSelectDraft={setOrderId} />

      <p className="text-xs text-muted-foreground">
        {busy ? "Ищу…" : `${total.toLocaleString("ru-RU")} позиций`} · страница {page + 1}/{pages}
        {deliverySort === "asc" ? " · сначала быстрые" : ""}
        {deliverySort === "desc" ? " · сначала долгие" : ""}
        {priceSort === "asc" ? " · цена ↑" : ""}
        {priceSort === "desc" ? " · цена ↓" : ""}
      </p>

      {displayed.length === 0 && !busy ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          Позиций нет. Загрузите прайс в карточке поставщика или откройте доп. фильтры.
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
            {displayed.map((offer) => {
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
                  onContextMenu={offerContextAdd(offer, addToDraft, clientId, orderId)}
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
                  <TableCell className="text-right">
                    {formatMoney(offer.price, offer.currency)}
                  </TableCell>
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
                    <AddToOrderButtons
                      offer={offer}
                      compact
                      clientId={clientId}
                      orderId={orderId || undefined}
                    />
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
        offers={displayed}
        suppliers={suppliers}
        clients={clients}
        clientId={clientId}
        orderId={orderId || undefined}
        markupPercent={settings.markupPercent}
        priceBands={settings.priceBands}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      <BrandDialog brand={brandInfo} onOpenChange={(open) => !open && setBrandInfo(null)} />
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка проценки…</p>}>
      <QuotePageInner />
    </Suspense>
  );
}
