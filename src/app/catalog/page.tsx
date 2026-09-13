"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
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
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, formatMoney, formatStock, normalizeSku } from "@/lib/format";
import { groupByOem, offerOems, offerTitle, searchHaystack } from "@/lib/oem";
import { sellUnitPrice } from "@/lib/pricing";
import { CATEGORIES } from "@/lib/types";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 16;

export default function CatalogPage() {
  const { ready, suppliers, offers, clients, settings, addToDraft } = useAvtoPrice();
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const brands = useMemo(
    () => Array.from(new Set(offers.map((offer) => offer.brand))).sort(),
    [offers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qSku = normalizeSku(query);
    const priceCap = Number.parseFloat(maxPrice.replace(",", ".")) || 0;
    const daysCap = Number.parseInt(maxDays, 10) || 0;
    return offers.filter((offer) => {
      if (supplierId !== "all" && offer.supplierId !== supplierId) return false;
      if (category !== "all" && offer.category !== category) return false;
      if (brand !== "all" && offer.brand !== brand) return false;
      if (inStock && offer.stock <= 0) return false;
      if (priceCap > 0 && offer.price > priceCap) return false;
      if (daysCap > 0 && (offer.deliveryDays || 99) > daysCap) return false;
      if (!q) return true;
      const oems = offerOems(offer);
      if (qSku && (normalizeSku(offer.sku) === qSku || oems.includes(qSku))) return true;
      return searchHaystack(offer).includes(q);
    });
  }, [offers, supplierId, category, brand, inStock, query, maxPrice, maxDays]);

  const groups = useMemo(() => groupByOem(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const visible = groups.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const names = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  function resetPage() {
    setPage(0);
  }

  async function addOffer(offer: Offer) {
    await addToDraft(offer, Math.max(1, offer.multiplicity || 1));
    toast.success(`${offer.sku} добавлен в заказ`);
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Собираю каталог…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог запчастей</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Поиск по артикулу и OEM, группы аналогов, фильтры по цене, сроку до Москвы, бренду и
          поставщику.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Артикул, OEM, кросс или название"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
          />
        </div>
        <Select
          value={supplierId}
          onValueChange={(value) => {
            if (value) {
              setSupplierId(value);
              resetPage();
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
              resetPage();
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
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(value) => {
            if (value) {
              setCategory(value);
              resetPage();
            }
          }}
        >
          <SelectTrigger className="w-full">
            <span className="flex flex-1 truncate text-left">
              {category === "all" ? "Все категории" : category}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Цена до, ₽"
          value={maxPrice}
          onChange={(event) => {
            setMaxPrice(event.target.value);
            resetPage();
          }}
        />
        <Input
          placeholder="Срок до Москвы, дн."
          value={maxDays}
          onChange={(event) => {
            setMaxDays(event.target.value);
            resetPage();
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={inStock}
            onCheckedChange={(checked) => {
              setInStock(checked === true);
              resetPage();
            }}
          />
          <Label className="font-normal">Только в наличии</Label>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {groups.length} групп OEM · {filtered.length} предложений · наценка {settings.markupPercent}%
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {offers.length === 0
            ? "Каталог пуст. Синхронизируйте API или загрузите файл."
            : "Нет позиций по этому фильтру."}
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((group) => {
            const open = openGroups.has(group.key) || Boolean(query.trim());
            const best = group.offers[0];
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
                    <p className="text-sm font-semibold">{formatMoney(group.minPrice)}</p>
                    <p className="text-xs text-muted-foreground">
                      от {formatDays(group.minDays)} · {formatStock(group.stock)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border-t bg-muted/20">
                    {group.offers.map((offer) => {
                      const sell = sellUnitPrice(offer.price, settings.markupPercent, 0);
                      return (
                        <div
                          key={offer.id}
                          className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelected(offer)}
                          >
                            <p className="font-mono text-xs">{offer.sku}</p>
                            <p className="text-sm">
                              {offer.brand} · {offerTitle(offer)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {names.get(offer.supplierId)} · {formatStock(offer.stock)} ·{" "}
                              {formatDays(offer.deliveryDays)} до Москвы
                            </p>
                          </button>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  offer.id === best.id && "text-emerald-700",
                                )}
                              >
                                {formatMoney(offer.price, offer.currency)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                с наценкой {formatMoney(sell, offer.currency)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void addOffer(offer)}
                            >
                              <ShoppingCart />
                              В заказ
                            </Button>
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
        markupPercent={settings.markupPercent}
        onAdd={(item) => void addOffer(item)}
        onOpenChange={(openState) => {
          if (!openState) setSelected(null);
        }}
      />
    </div>
  );
}
