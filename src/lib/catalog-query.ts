import { applyPairFields } from "@/lib/offer-extra";
import { browseCatalog, catalogMeta, type CatalogBrowseFilter } from "@/lib/file-catalog";
import { isRosskoDemo, isRosskoSupplier, rosskoSearch } from "@/lib/rossko";
import type { Offer, Supplier } from "@/lib/types";

export interface QueryFilters extends CatalogBrowseFilter {
  supplierId?: string;
  live?: boolean;
  page?: number;
  pageSize?: number;
}

export async function queryPriceOffers(
  suppliers: Supplier[],
  demoOffers: Offer[],
  filters: QueryFilters,
) {
  const page = Math.max(filters.page ?? 0, 0);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 40, 1), 120);
  const offset = page * pageSize;
  const selected = suppliers.filter(
    (item) => item.active !== false && (!filters.supplierId || item.id === filters.supplierId),
  );
  const brandMap = new Map<string, number>();
  const offers: Offer[] = [];
  let total = 0;
  let catalogRows = 0;
  let remainingSkip = offset;
  let remainingTake = pageSize;

  const filter: CatalogBrowseFilter = {
    q: filters.q,
    brand: filters.brand,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    maxDays: filters.maxDays,
    inStock: filters.inStock,
    changedOnly: filters.changedOnly,
  };

  for (const supplier of selected) {
    const chunk = await browseCatalog(supplier, {
      ...filter,
      offset: remainingSkip,
      limit: Math.max(remainingTake, 0),
    });
    catalogRows += chunk.count;
    total += chunk.total;
    for (const brand of chunk.brands) {
      brandMap.set(brand.name, (brandMap.get(brand.name) ?? 0) + brand.count);
    }
    if (remainingSkip >= chunk.total) {
      remainingSkip -= chunk.total;
      continue;
    }
    remainingSkip = 0;
    offers.push(...chunk.offers);
    remainingTake -= chunk.offers.length;
  }

  const q = (filters.q ?? "").trim().toLowerCase();
  const demoHits = selected.length
    ? demoOffers.filter((offer) => {
        if (filters.supplierId && offer.supplierId !== filters.supplierId) return false;
        if (filters.brand && offer.brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
        if (filters.inStock && offer.stock <= 0) return false;
        if (filters.minPrice && offer.price < filters.minPrice) return false;
        if (filters.maxPrice && offer.price > filters.maxPrice) return false;
        if (filters.maxDays && (offer.deliveryDays || 99) > filters.maxDays) return false;
        if (filters.changedOnly && !offer.changedAt) return false;
        if (!q) return true;
        return (
          offer.sku.toLowerCase().includes(q) ||
          offer.brand.toLowerCase().includes(q) ||
          offer.name.toLowerCase().includes(q) ||
          offer.oem.toLowerCase().includes(q)
        );
      })
    : [];

  const demoSlice = demoHits.slice(0, Math.max(0, 12));
  const seen = new Set(offers.map((item) => item.id));
  for (const offer of demoSlice) {
    if (seen.has(offer.id)) continue;
    offers.push(applyPairFields(offer));
    seen.add(offer.id);
  }

  if (filters.live && q.length >= 2) {
    for (const supplier of selected) {
      if (supplier.adapter !== "rossko" || isRosskoDemo(supplier)) continue;
      if (!isRosskoSupplier(supplier)) continue;
      try {
        const live = await rosskoSearch(supplier, q);
        for (const offer of live.offers) {
          if (seen.has(offer.id)) continue;
          offers.push(applyPairFields(offer));
          seen.add(offer.id);
        }
      } catch {
        // file catalog remains the source of truth
      }
    }
  }

  const brands = Array.from(brandMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"))
    .slice(0, 250);

  return {
    offers: offers.slice(0, pageSize + demoSlice.length),
    total: total + demoHits.length,
    page,
    pageSize,
    brands,
    catalogRows,
  };
}

export async function priceMeta(suppliers: Supplier[]) {
  const brands = new Map<string, number>();
  let rows = 0;
  const perSupplier: { id: string; name: string; count: number }[] = [];
  for (const supplier of suppliers.filter((item) => item.active !== false)) {
    const meta = await catalogMeta(supplier);
    rows += meta.count;
    perSupplier.push({ id: supplier.id, name: supplier.name, count: meta.count || supplier.catalogCount || 0 });
    for (const brand of meta.brands) {
      brands.set(brand.name, (brands.get(brand.name) ?? 0) + brand.count);
    }
  }
  return {
    rows,
    suppliers: perSupplier,
    brands: Array.from(brands.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 250),
  };
}
