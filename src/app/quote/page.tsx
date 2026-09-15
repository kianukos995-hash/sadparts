"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";
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
import {
  AddToOrderButtons,
  openQuoteContextMenu,
  type QuoteMenuState,
} from "@/components/add-to-order";
import { QuoteContextMenu } from "@/components/quote-context-menu";
import { ClientCartBar } from "@/components/client-carts";
import { SearchPick } from "@/components/search-pick";
import { SortToggle, type SortDir } from "@/components/sort-toggle";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useViewerPricing } from "@/hooks/use-viewer-pricing";
import { formatDays, formatMoney, formatStock } from "@/lib/format";
import { findDraftForClient } from "@/lib/order";
import { applicabilityOf, sellWarning } from "@/lib/offer-extra";
import { pairLabel } from "@/lib/pairs";
import { PriceFormula } from "@/components/price-formula";
import { clientPriceBreakdown } from "@/lib/pricing";
import { sortOffers } from "@/lib/sort-offers";
import { availableStock, formatFreeStock, reservedQty } from "@/lib/stock";
import { ownQty } from "@/lib/warehouse";
import { CATEGORIES, type Offer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { normalizeSku } from "@/lib/format";

function QuotePageInner() {
  const searchParams = useSearchParams();
  const {
    ready,
    suppliers,
    clients,
    settings,
    drafts,
    orders,
    setActiveDraftId,
    removeOrder,
    draft,
    warehouseLots,
  } = useAvtoPrice();
  const [sku, setSku] = useState(() => searchParams.get("sku") || searchParams.get("q") || "");
  const [name, setName] = useState(() => searchParams.get("name") || "");
  const [category, setCategory] = useState(() => searchParams.get("category") || "");
  const [supplierId, setSupplierId] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [inStock, setInStock] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false);
  const [live, setLive] = useState(false);
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [orderId, setOrderId] = useState(searchParams.get("orderId") ?? "");
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [skuOffers, setSkuOffers] = useState<Offer[]>([]);
  const [menu, setMenu] = useState<QuoteMenuState | null>(null);
  const viewer = useViewerPricing(clientId);
  const quoteClientId = viewer.locked && viewer.clientId ? viewer.clientId : clientId;

  const client = viewer.client ?? clients.find((item) => item.id === quoteClientId);
  const targetOrder = orders.find((item) => item.id === orderId) ?? null;
  const names = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item.name])),
    [suppliers],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- quote opens with ?clientId=&orderId= from an order */
    const fromClient = searchParams.get("clientId") ?? "";
    const fromOrder = searchParams.get("orderId") ?? "";
    const fromSku = searchParams.get("sku") || searchParams.get("q") || "";
    const fromName = searchParams.get("name") ?? "";
    const fromCategory = searchParams.get("category") ?? "";
    if (fromClient) setClientId(fromClient);
    if (fromOrder) {
      setOrderId(fromOrder);
      setActiveDraftId(fromOrder);
    }
    if (fromSku) setSku(fromSku);
    if (fromName) setName(fromName);
    if (fromCategory) setCategory(fromCategory);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams, setActiveDraftId]);

  const load = useCallback(() => {
    const q = [sku, name].filter(Boolean).join(" ").trim();
    if (viewer.locked && !q && !category) {
      setOffers([]);
      setTotal(0);
      setBusy(false);
      return;
    }
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (!viewer.locked && supplierId !== "all") params.set("supplierId", supplierId);
    if (brand !== "all") params.set("brand", brand);
    if (category) params.set("category", category);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (maxDays) params.set("maxDays", maxDays);
    if (inStock) params.set("inStock", "1");
    if (changedOnly) params.set("changed", "1");
    if (live && !viewer.locked) params.set("live", "1");
    if (quoteClientId) params.set("clientId", quoteClientId);
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
  }, [
    sku,
    name,
    category,
    supplierId,
    brand,
    minPrice,
    maxPrice,
    maxDays,
    inStock,
    changedOnly,
    live,
    page,
    quoteClientId,
    viewer.locked,
  ]);

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
    !viewer.locked && supplierId !== "all",
    brand !== "all",
    Boolean(category),
    minPrice,
    maxPrice,
    maxDays,
    inStock,
    changedOnly,
    live,
    priceSort,
  ].filter(Boolean).length;
  const colCount = viewer.locked ? 7 : viewer.showCost ? 9 : 8;
  const searched = Boolean(sku.trim() || name.trim() || category);

  function sellOf(offer: Offer) {
    if (offer.sellPrice != null) return offer.sellPrice;
    if (viewer.locked) return offer.price;
    const breakdown = clientPriceBreakdown(
      offer.price,
      viewer.bands,
      settings.markupPercent,
      client,
    );
    return breakdown.sell;
  }

  function openExpand(offer: Offer) {
    const key = normalizeSku(offer.sku);
    setExpanded((current) => (current === offer.id ? null : offer.id));
    const local = displayed.filter((item) => normalizeSku(item.sku) === key);
    setSkuOffers(local);
    void fetch(
      `/api/catalog/browse?q=${encodeURIComponent(offer.sku)}&field=sku&pageSize=40${quoteClientId ? `&clientId=${quoteClientId}` : ""}`,
    )
      .then(async (response) => {
        const data = (await response.json()) as { offers?: Offer[] };
        const rows = (data.offers ?? []).filter((item) => normalizeSku(item.sku) === key);
        setSkuOffers(rows.length ? rows : local);
      })
      .catch(() => setSkuOffers(local));
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Готовлю проценку…</p>;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Проценка</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewer.locked
            ? "Цена продажная. Срок — дни поставки. Поставщиков не показываем. Ищите по артикулу, названию или категории — полный прайс закрыт."
            : "Цена — продажная с наценкой категории. ПКМ открывает меню, а не новый заказ. Ноль на складе нельзя положить в корзину."}
        </p>
      </div>

      {targetOrder || draft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span>
            Текущий черновик{" "}
            <span className="font-mono font-semibold">
              {(targetOrder ?? draft)?.number}
            </span>
            {client ? ` · ${client.name}` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {(targetOrder ?? draft) ? (
              <Link
                href={
                  (targetOrder ?? draft)!.status === "draft"
                    ? `/cart?id=${(targetOrder ?? draft)!.id}`
                    : `/orders/${(targetOrder ?? draft)!.id}`
                }
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                К корзине
              </Link>
            ) : null}
            {draft ? (
              <Button
                size="sm"
                variant="ghost"
                title="Сбросить черновик"
                onClick={() => {
                  if (!confirm(`Удалить черновик ${draft.number}?`)) return;
                  void removeOrder(draft.id).then(() => {
                    setOrderId("");
                    toast.success("Черновик удалён");
                  });
                }}
              >
                <X />
                Сбросить
              </Button>
            ) : null}
          </div>
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
          {!viewer.locked ? (
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
          ) : (
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Клиент</Label>
              <p className="flex h-9 items-center rounded-lg border px-3 text-sm">
                {client?.name || "Гость"}
              </p>
            </div>
          )}
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

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              !category ? "border-amber-400 bg-amber-50 font-medium" : "hover:bg-muted",
            )}
            onClick={() => {
              setCategory("");
              setPage(0);
            }}
          >
            Все категории
          </button>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                category === item ? "border-amber-400 bg-amber-50 font-medium" : "hover:bg-muted",
              )}
              onClick={() => {
                setCategory(item);
                setPage(0);
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {filtersOpen ? (
          <div className="grid gap-3 rounded-lg border border-dashed bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {!viewer.locked ? (
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
            ) : null}
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
              {viewer.showAdminCost ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={changedOnly}
                    onCheckedChange={(checked) => setChangedOnly(checked === true)}
                  />
                  <Label className="font-normal">Обновления цены</Label>
                </label>
              ) : null}
              {viewer.showAdminCost ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={live} onCheckedChange={(checked) => setLive(checked === true)} />
                  <Label className="font-normal">Живой Росско</Label>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {!viewer.locked ? (
        <ClientCartBar clientId={quoteClientId} onClientId={setClientId} onSelectDraft={setOrderId} />
      ) : null}

      <p className="text-xs text-muted-foreground">
        {viewer.locked && !searched
          ? "Введите артикул, название или выберите категорию — полный список скрыт."
          : busy
            ? "Ищу…"
            : `${total.toLocaleString("ru-RU")} позиций`}
        {searched || !viewer.locked ? ` · страница ${page + 1}/${pages}` : ""}
      </p>

      {displayed.length === 0 && !busy ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {viewer.locked && !searched
            ? "Полный каталог закрыт. Найдите запчасть по артикулу, OEM, названию или категории с главной."
            : viewer.locked
              ? "По этому запросу позиций нет. Попробуйте другой артикул или категорию."
              : "Позиций нет. Загрузите прайс в карточке поставщика или откройте доп. фильтры."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Артикул</TableHead>
              <TableHead>Бренд</TableHead>
              <TableHead>Наименование</TableHead>
              {viewer.locked ? null : <TableHead>Поставщик</TableHead>}
              {viewer.showCost ? (
                <TableHead className="text-right">{viewer.costLabel}</TableHead>
              ) : null}
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Срок</TableHead>
              <TableHead className="text-right">{viewer.locked ? "Наличие" : "Ост. у пост."}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((offer) => {
              const breakdown = clientPriceBreakdown(
                offer.price,
                viewer.bands,
                settings.markupPercent,
                client,
              );
              const sell = sellOf(offer);
              const warn = viewer.showCost
                ? sellWarning(offer.price, viewer.bands, settings.markupPercent, client)
                : "";
              const cars = applicabilityOf(offer);
              const open = expanded === offer.id;
              return (
                <Fragment key={offer.id}>
                  <TableRow
                    key={offer.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (viewer.locked) {
                        openExpand(offer);
                        return;
                      }
                      setSelected(offer);
                      void fetch("/api/activity/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "view_offer",
                          detail: `Проценка ${offer.sku} ${offer.brand}`,
                          path: "/quote",
                          sku: offer.sku,
                          brand: offer.brand,
                          offerId: offer.id,
                          sellPrice: sell,
                          stock: offer.stock,
                          deliveryDays: offer.deliveryDays,
                        }),
                      });
                    }}
                    onContextMenu={(event) => openQuoteContextMenu(event, offer, setMenu)}
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
                      {viewer.showCost ? <PriceChange offer={offer} /> : null}
                    </TableCell>
                    {viewer.locked ? null : (
                    <TableCell className="text-xs">
                      <p>{names.get(offer.supplierId)}</p>
                      <p className="text-[11px] text-muted-foreground">{offer.warehouse || "склад не указан"}</p>
                    </TableCell>
                    )}
                    {viewer.showCost ? (
                      <TableCell className="text-right">
                        {formatMoney(offer.costPrice ?? offer.price, offer.currency)}
                      </TableCell>
                    ) : null}
                    <TableCell className={cn("text-right", warn && "text-amber-800")}>
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium">{formatMoney(sell, offer.currency)}</span>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          type="button"
                          title={viewer.locked ? "Склады и сроки" : "Склады и поставщики"}
                          onClick={(event) => {
                            event.stopPropagation();
                            openExpand(offer);
                          }}
                        >
                          <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
                        </Button>
                      </div>
                      {viewer.view !== "clean" && !viewer.locked ? (
                        <PriceFormula
                          breakdown={breakdown}
                          currency={offer.currency}
                          compact
                          view={viewer.view}
                        />
                      ) : null}
                      {warn && viewer.showCost ? (
                        <p className="text-[10px] font-normal">ниже закупа</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatDays(offer.deliveryDays)}
                    </TableCell>
                    <TableCell className="text-right">
                      <p>{formatFreeStock(availableStock(offer, orders), reservedQty(orders, offer.id))}</p>
                      {viewer.locked ? (
                        <p className="text-[10px] text-muted-foreground">на складе</p>
                      ) : (
                        <>
                      <p className="text-[10px] text-muted-foreground">у поставщика</p>
                      <p className="text-[10px] text-muted-foreground">
                          свой склад {ownQty(warehouseLots, offer.sku, offer.brand, viewer.user?.organizationId)} шт.
                        </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <AddToOrderButtons
                        offer={offer}
                        compact
                        clientId={quoteClientId}
                        orderId={orderId || undefined}
                      />
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow key={`${offer.id}-warehouses`}>
                      <TableCell colSpan={colCount} className="bg-muted/30">
                        <p className="mb-2 text-xs font-medium">
                          {viewer.locked
                            ? `Все склады и сроки ${offer.sku}`
                            : `Все склады и поставщики ${offer.sku}`}
                        </p>
                        <div className="grid gap-2">
                          {(skuOffers.length ? skuOffers : [offer]).map((row) => (
                            <div
                              key={row.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                            >
                              <div>
                                {viewer.locked ? (
                                  <>
                                    <p className="text-sm font-medium">
                                      Склад · срок {formatDays(row.deliveryDays)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      наличие {formatStock(row.stock)}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium">
                                      {names.get(row.supplierId) || "Поставщик"} · склад{" "}
                                      {row.warehouse || "не указан"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDays(row.deliveryDays)} с этого склада · у поставщика{" "}
                                      {formatStock(row.stock)}
                                    </p>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm font-semibold">
                                  {formatMoney(sellOf(row), row.currency)}
                                </p>
                                <AddToOrderButtons
                                  offer={row}
                                  compact
                                  clientId={quoteClientId}
                                  orderId={orderId || undefined}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
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

      {!viewer.locked ? (
        <OfferDrawer
          offer={selected}
          offers={displayed}
          suppliers={suppliers}
          clients={clients}
          clientId={quoteClientId}
          orderId={orderId || undefined}
          markupPercent={settings.markupPercent}
          priceBands={viewer.bands}
          onOpenChange={(openState) => !openState && setSelected(null)}
        />
      ) : selected ? (
        <OfferDrawer
          offer={selected}
          offers={skuOffers.length ? skuOffers : displayed}
          suppliers={suppliers}
          clients={clients}
          clientId={quoteClientId}
          orderId={orderId || undefined}
          markupPercent={settings.markupPercent}
          priceBands={viewer.bands}
          compact
          onOpenChange={(openState) => !openState && setSelected(null)}
        />
      ) : null}
      <BrandDialog brand={brandInfo} onOpenChange={(open) => !open && setBrandInfo(null)} />
      <QuoteContextMenu
        menu={menu}
        clientId={quoteClientId}
        orderId={orderId || undefined}
        onClose={() => setMenu(null)}
        onDetails={(offer) => {
          if (viewer.locked) openExpand(offer);
          else setSelected(offer);
        }}
      />
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
