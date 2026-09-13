"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfferDrawer } from "@/components/offer-drawer";
import { PartsTable } from "@/components/parts-table";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { CATEGORIES } from "@/lib/types";
import type { Offer } from "@/lib/types";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 40;

export default function CatalogPage() {
  const { ready, suppliers, offers } = useAvtoPrice();
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Offer | null>(null);

  const brands = useMemo(
    () => Array.from(new Set(offers.map((offer) => offer.brand))).sort(),
    [offers],
  );

  const cheapestIds = useMemo(() => {
    const groups = new Map<string, Offer>();
    for (const offer of offers) {
      const key = offer.oem || `${offer.brand}:${offer.sku}`;
      const current = groups.get(key);
      if (!current || offer.price < current.price) groups.set(key, offer);
    }
    return new Set(Array.from(groups.values()).map((offer) => offer.id));
  }, [offers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers
      .filter((offer) => (supplierId === "all" ? true : offer.supplierId === supplierId))
      .filter((offer) => (category === "all" ? true : offer.category === category))
      .filter((offer) => (brand === "all" ? true : offer.brand === brand))
      .filter((offer) => (inStock ? offer.stock > 0 : true))
      .filter((offer) => {
        if (!q) return true;
        return [offer.sku, offer.brand, offer.name, offer.oem]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [offers, supplierId, category, brand, inStock, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!ready) return <p className="text-sm text-muted-foreground">Собираю каталог…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог запчастей</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сводный прайс по всем поставщикам. Зелёная цена — минимальная среди аналогов с тем же OEM.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Артикул, OEM, бренд или название"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
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
            <SelectValue placeholder="Поставщик" />
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
          value={category}
          onValueChange={(value) => {
            if (value) {
              setCategory(value);
              setPage(0);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Категория" />
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
            <SelectValue placeholder="Бренд" />
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
        <label className="flex items-center gap-2 text-sm md:col-span-3">
          <Checkbox
            checked={inStock}
            onCheckedChange={(checked) => {
              setInStock(checked === true);
              setPage(0);
            }}
          />
          <Label className="font-normal">Только в наличии</Label>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">Найдено {filtered.length} предложений</p>

      <PartsTable
        offers={visible}
        suppliers={suppliers}
        cheapestIds={cheapestIds}
        onSelect={setSelected}
        empty={
          offers.length === 0
            ? "Каталог пуст. Синхронизируйте API или загрузите файл."
            : "Нет позиций по этому фильтру."
        }
      />

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
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
