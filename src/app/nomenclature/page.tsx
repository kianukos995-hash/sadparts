"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleGate } from "@/components/role-gate";
import { Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OfferSpecs } from "@/components/offer-specs";
import { OfferMedia } from "@/components/offer-media";
import { NomenclatureEdit } from "@/components/nomenclature-edit";
import { AddToOrderButtons } from "@/components/add-to-order";
import { SearchPick } from "@/components/search-pick";
import { SupplierFilter } from "@/components/supplier-filter";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useViewerPricing } from "@/hooks/use-viewer-pricing";
import { formatMoney } from "@/lib/format";
import { PriceFormula } from "@/components/price-formula";
import { clientPriceBreakdown } from "@/lib/pricing";
import { availableStock, formatFreeStock, reservedQty } from "@/lib/stock";
import { isDisplayableImage } from "@/lib/media";
import type { Offer } from "@/lib/types";

type Scope = "all" | "stock" | "photo";
type SearchField = "any" | "sku" | "oem" | "name" | "brand";

export default function NomenclaturePage() {
  return (
    <RoleGate allow={["admin", "organization", "manager"]}>
      <NomenclatureInner />
    </RoleGate>
  );
}

function NomenclatureInner() {
  const { ready, suppliers, orders, settings } = useAvtoPrice();
  const viewer = useViewerPricing();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [searchField, setSearchField] = useState<SearchField>("any");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Offer[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (searchField !== "any") params.set("field", searchField);
    if (brand) params.set("brand", brand);
    if (supplierId) params.set("supplierId", supplierId);
    if (scope === "stock") params.set("inStock", "1");
    params.set("page", String(page));
    params.set("pageSize", "24");
    setBusy(true);
    void fetch(`/api/catalog/browse?${params}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          offers?: Offer[];
          total?: number;
          brands?: { name: string; count: number }[];
        };
        setRows(data.offers ?? []);
        setTotal(data.total ?? 0);
        if (data.brands?.length) setBrands(data.brands);
      })
      .finally(() => setBusy(false));
  }, [query, brand, supplierId, scope, page, searchField]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const categories = useMemo(
    () =>
      Array.from(new Set(rows.map((item) => item.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [rows],
  );

  const unique = useMemo(() => {
    return rows.filter((offer) => {
      if (category && offer.category !== category) return false;
      if (scope === "photo") {
        return (offer.images ?? []).some((src) => isDisplayableImage(src));
      }
      return true;
    });
  }, [rows, category, scope]);

  const pages = Math.max(1, Math.ceil(total / 24));

  if (!ready) return <p className="text-sm text-muted-foreground">Собираю номенклатуру…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Номенклатура</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Все позиции прайса. В строке поиска — подпункты: артикул, OEM, название, бренд. В карточке
          поля зависят от типа детали. Остаток падает, когда позиция в корзине, и списывается при
          сборке заказа.
        </p>
      </div>
      <div className="grid gap-2 rounded-xl border p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={
                searchField === "sku"
                  ? "Артикул / GUID"
                  : searchField === "oem"
                    ? "OEM / кросс"
                    : searchField === "name"
                      ? "Название"
                      : searchField === "brand"
                        ? "Бренд"
                        : "Артикул, OEM, бренд, название"
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["any", "Везде"],
                ["sku", "Артикул"],
                ["oem", "OEM"],
                ["name", "Название"],
                ["brand", "Бренд"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={searchField === id ? "default" : "outline"}
                onClick={() => {
                  setSearchField(id);
                  setPage(0);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", "Все"],
              ["stock", "В наличии"],
              ["photo", "С фото"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={scope === id ? "default" : "outline"}
              onClick={() => {
                setScope(id);
                setPage(0);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Бренд</Label>
            <SearchPick
              value={brand}
              onChange={(id) => {
                setBrand(id);
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
          <div className="sm:col-span-3">
            <SupplierFilter
              suppliers={suppliers}
              value={supplierId || "all"}
              onChange={(id) => {
                setSupplierId(id === "all" ? "" : id);
                setPage(0);
              }}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Категория</Label>
            <SearchPick
              value={category}
              onChange={setCategory}
              placeholder="Категория на странице…"
              emptyLabel="Все категории"
              options={categories.map((item) => ({ id: item, label: item }))}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {busy ? "Ищу…" : `${total.toLocaleString("ru-RU")} позиций в прайсах`} · страница {page + 1}/
        {pages}
      </p>
      {unique.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            В прайсах нет строк под фильтр. Загрузите прайс поставщика или снимите «С фото».
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {unique.map((offer) => {
            const breakdown = clientPriceBreakdown(
              offer.price,
              viewer.bands,
              settings.markupPercent,
            );
            const sell = offer.sellPrice ?? breakdown.sell;
            const reserved = reservedQty(orders, offer.id);
            const free = availableStock(offer, orders);
            return (
              <article key={offer.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <OfferMedia images={offer.images} sku={offer.sku} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{offer.sku}</p>
                        <h2 className="text-base font-medium">
                          {offer.brand} · {offer.displayName || offer.name}
                        </h2>
                        {offer.guid ? (
                          <p className="text-xs text-muted-foreground">GUID {offer.guid}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Остаток {formatFreeStock(free, reserved)}
                          {reserved ? ` · в корзине ${reserved} шт.` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <Badge variant="secondary">{formatMoney(sell)}</Badge>
                          {viewer.showCost ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {viewer.costLabel.toLowerCase()} {formatMoney(offer.costPrice ?? offer.price)}
                            </p>
                          ) : null}
                          {viewer.view !== "clean" ? (
                            <PriceFormula breakdown={breakdown} compact view={viewer.view} />
                          ) : null}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditing(offer)}>
                          <Pencil />
                          Изменить
                        </Button>
                        <AddToOrderButtons offer={offer} compact />
                      </div>
                    </div>
                    <OfferSpecs specs={offer.specs} defaultOpen />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
      <NomenclatureEdit
        offer={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(next) => {
          setRows((current) => current.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
        }}
      />
    </div>
  );
}
