import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { normalizeSku, offerKey } from "@/lib/format";
import { applyPatch, readPatches } from "@/lib/offer-patches";
import { applyPairFields } from "@/lib/offer-extra";
import type { Offer, Supplier } from "@/lib/types";

const DIR = path.join(process.cwd(), "data", "catalogs");

export interface CatalogRow {
  guid: string;
  sku: string;
  brand: string;
  name: string;
  oem: string;
  price: number;
  stock: number;
  days: number;
  multiplicity: number;
  crosses: string[];
  vendor?: string;
  stockId?: string;
  specs?: Record<string, string>;
  images?: string[];
  category?: string;
  warehouse?: string;
  notes?: string;
  applicability?: string;
  displayName?: string;
  prevPrice?: number;
  prevStock?: number;
  priceDelta?: number;
  stockDelta?: number;
  changedAt?: string;
  updatedAt?: string;
}

interface CatalogIndex {
  rows: CatalogRow[];
  bySku: Map<string, number[]>;
  byOem: Map<string, number[]>;
  byBrand: Map<string, number[]>;
  brands: { name: string; count: number }[];
}

const cache = new Map<string, CatalogIndex>();

function filePath(supplierId: string) {
  return path.join(DIR, `${supplierId}.jsonl`);
}

function addIndex(map: Map<string, number[]>, key: string, index: number) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(index);
  else map.set(key, [index]);
}

function buildIndex(rows: CatalogRow[]): CatalogIndex {
  const bySku = new Map<string, number[]>();
  const byOem = new Map<string, number[]>();
  const byBrand = new Map<string, number[]>();
  const brandCount = new Map<string, number>();
  rows.forEach((row, index) => {
    addIndex(bySku, normalizeSku(row.sku.split("@")[0]), index);
    addIndex(bySku, normalizeSku(row.guid), index);
    if (row.vendor) addIndex(bySku, normalizeSku(row.vendor), index);
    addIndex(byOem, normalizeSku(row.oem), index);
    for (const cross of row.crosses) addIndex(byOem, normalizeSku(cross), index);
    const brandKey = row.brand.trim();
    if (brandKey) {
      addIndex(byBrand, brandKey.toLowerCase(), index);
      brandCount.set(brandKey, (brandCount.get(brandKey) ?? 0) + 1);
    }
  });
  const brands = Array.from(brandCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
  return { rows, bySku, byOem, byBrand, brands };
}

export async function writeCatalog(supplierId: string, rows: CatalogRow[]) {
  await mkdir(DIR, { recursive: true });
  const stream = createWriteStream(filePath(supplierId), { encoding: "utf8" });
  for (const row of rows) {
    const line = `${JSON.stringify(row)}\n`;
    if (!stream.write(line)) await once(stream, "drain");
  }
  stream.end();
  await once(stream, "finish");
  cache.set(supplierId, buildIndex(rows));
}

export async function removeCatalog(supplierId: string) {
  cache.delete(supplierId);
  try {
    await unlink(filePath(supplierId));
  } catch {
    // no catalog
  }
}

export async function readCatalog(supplierId: string): Promise<CatalogIndex> {
  const hit = cache.get(supplierId);
  if (hit) return hit;
  try {
    const raw = await readFile(filePath(supplierId), "utf8");
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CatalogRow);
    const index = buildIndex(rows);
    cache.set(supplierId, index);
    return index;
  } catch {
    const empty = buildIndex([]);
    cache.set(supplierId, empty);
    return empty;
  }
}

export function invalidateCatalog(supplierId?: string) {
  if (supplierId) cache.delete(supplierId);
  else cache.clear();
}

export function catalogSize(supplierId?: string) {
  if (!supplierId) return 0;
  return cache.get(supplierId)?.rows.length ?? 0;
}

export async function searchCatalog(supplier: Supplier, query: string, limit = 80): Promise<Offer[]> {
  const q = normalizeSku(query);
  if (q.length < 2) return [];
  const index = await readCatalog(supplier.id);
  const ids = new Set<number>([
    ...(index.bySku.get(q) ?? []),
    ...(index.byOem.get(q) ?? []),
  ]);
  if (ids.size === 0) {
    for (const [sku, idxs] of index.bySku) {
      if (sku.includes(q)) {
        for (const i of idxs) ids.add(i);
        if (ids.size >= limit) break;
      }
    }
  }
  if (ids.size === 0) {
    const lower = query.trim().toLowerCase();
    for (let i = 0; i < index.rows.length; i += 1) {
      const row = index.rows[i];
      if (row.brand.toLowerCase().includes(lower) || row.name.toLowerCase().includes(lower)) {
        ids.add(i);
        if (ids.size >= limit) break;
      }
    }
  }
  const now = new Date().toISOString();
  const patches = await readPatches(supplier.id);
  return Array.from(ids)
    .slice(0, limit)
    .map((i) => applyPatch(catalogRowToOffer(supplier, index.rows[i], now), patches));
}

export interface CatalogBrowseFilter {
  q?: string;
  qField?: "any" | "sku" | "oem" | "name" | "brand";
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  maxDays?: number;
  inStock?: boolean;
  changedOnly?: boolean;
  offset?: number;
  limit?: number;
}

function rowMatches(row: CatalogRow, filter: CatalogBrowseFilter, q: string, qSku: string) {
  if (filter.brand && row.brand.toLowerCase() !== filter.brand.toLowerCase()) return false;
  if (filter.inStock && row.stock <= 0) return false;
  if (filter.minPrice && row.price < filter.minPrice) return false;
  if (filter.maxPrice && row.price > filter.maxPrice) return false;
  if (filter.maxDays && (row.days || 99) > filter.maxDays) return false;
  if (filter.changedOnly && !row.changedAt) return false;
  if (filter.changedOnly && !(row.priceDelta || row.stockDelta)) return false;
  if (!q) return true;
  const sku = normalizeSku(row.sku);
  const oem = normalizeSku(row.oem);
  const field = filter.qField || "any";
  if (field === "sku") {
    return sku.includes(qSku) || normalizeSku(row.guid).includes(qSku);
  }
  if (field === "oem") {
    return oem.includes(qSku) || row.crosses.some((item) => normalizeSku(item).includes(qSku));
  }
  if (field === "name") {
    return row.name.toLowerCase().includes(q);
  }
  if (field === "brand") {
    return row.brand.toLowerCase().includes(q);
  }
  if (qSku && (sku.includes(qSku) || oem.includes(qSku) || normalizeSku(row.guid).includes(qSku))) {
    return true;
  }
  return (
    row.brand.toLowerCase().includes(q) ||
    row.name.toLowerCase().includes(q) ||
    (row.applicability ?? "").toLowerCase().includes(q) ||
    (row.notes ?? "").toLowerCase().includes(q)
  );
}

function browseIsOpen(filter: CatalogBrowseFilter) {
  return (
    !(filter.q ?? "").trim() &&
    !filter.brand &&
    !filter.minPrice &&
    !filter.maxPrice &&
    !filter.maxDays &&
    !filter.inStock &&
    !filter.changedOnly
  );
}

export async function browseCatalog(supplier: Supplier, filter: CatalogBrowseFilter) {
  const index = await readCatalog(supplier.id);
  const limit = Math.min(Math.max(filter.limit ?? 40, 0), 120);
  const offset = Math.max(filter.offset ?? 0, 0);
  const patches = await readPatches(supplier.id);
  const now = new Date().toISOString();

  if (browseIsOpen(filter)) {
    const slice = index.rows.slice(offset, offset + limit);
    return {
      offers: slice.map((row) => applyPatch(catalogRowToOffer(supplier, row, now), patches)),
      total: index.rows.length,
      brands: index.brands.slice(0, 250),
      count: index.rows.length,
    };
  }
  const q = (filter.q ?? "").trim().toLowerCase();
  const qSku = normalizeSku(filter.q ?? "");
  const seen = new Set<number>();
  let matched = 0;
  const offers: Offer[] = [];
  const visit = (i: number) => {
    if (seen.has(i)) return;
    seen.add(i);
    const row = index.rows[i];
    if (!row || !rowMatches(row, filter, q, qSku)) return;
    if (matched >= offset && offers.length < limit) {
      offers.push(applyPatch(catalogRowToOffer(supplier, row, now), patches));
    }
    matched += 1;
  };
  const field = filter.qField || "any";
  const candidateIdx =
    filter.brand && !q
      ? (index.byBrand.get(filter.brand.toLowerCase()) ?? [])
      : field === "name" || field === "brand"
        ? undefined
        : qSku.length >= 2
          ? uniqueIndexes(
              field === "oem"
                ? [...(index.byOem.get(qSku) ?? []), ...prefixIndexes(index.byOem, qSku, 400)]
                : field === "sku"
                  ? [...(index.bySku.get(qSku) ?? []), ...prefixIndexes(index.bySku, qSku, 400)]
                  : [
                      ...(index.bySku.get(qSku) ?? []),
                      ...(index.byOem.get(qSku) ?? []),
                      ...prefixIndexes(index.bySku, qSku, 400),
                    ],
            )
          : undefined;

  if (candidateIdx) {
    for (const i of candidateIdx) visit(i);
    if (offers.length < limit && q && matched < limit + offset) {
      for (let i = 0; i < index.rows.length && offers.length < limit; i += 1) visit(i);
    }
  } else {
    for (let i = 0; i < index.rows.length; i += 1) {
      visit(i);
      if (offers.length >= limit && matched > offset + limit && !q) {
        // keep counting remaining for total
      }
    }
  }

  return {
    offers,
    total: candidateIdx && qSku.length >= 2 ? Math.max(matched, offers.length) : matched,
    brands: index.brands.slice(0, 250),
    count: index.rows.length,
  };
}

function uniqueIndexes(list: number[]) {
  return Array.from(new Set(list));
}

function prefixIndexes(map: Map<string, number[]>, prefix: string, cap: number) {
  if (prefix.length < 2) return [];
  const out: number[] = [];
  for (const [sku, idxs] of map) {
    if (!sku.includes(prefix)) continue;
    for (const i of idxs) {
      out.push(i);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

export async function catalogMeta(supplier: Supplier) {
  const index = await readCatalog(supplier.id);
  return { count: index.rows.length, brands: index.brands.slice(0, 250) };
}

export function applyImportDiff(previous: CatalogRow[], next: CatalogRow[]) {
  const prevMap = new Map(previous.map((row) => [`${row.guid}:${normalizeSku(row.sku)}`, row]));
  const now = new Date().toISOString();
  let changed = 0;
  const rows = next.map((row) => {
    const old = prevMap.get(`${row.guid}:${normalizeSku(row.sku)}`);
    if (!old) {
      return { ...row, updatedAt: now };
    }
    const priceChanged = old.price !== row.price;
    const stockChanged = old.stock !== row.stock;
    if (priceChanged || stockChanged) {
      changed += 1;
      return {
        ...row,
        prevPrice: old.price,
        prevStock: old.stock,
        priceDelta: row.price - old.price,
        stockDelta: row.stock - old.stock,
        changedAt: now,
        updatedAt: now,
        notes: row.notes ?? old.notes,
        applicability: row.applicability ?? old.applicability,
        displayName: row.displayName ?? old.displayName,
        crosses: row.crosses.length ? row.crosses : old.crosses,
      };
    }
    return {
      ...row,
      prevPrice: old.prevPrice,
      prevStock: old.prevStock,
      priceDelta: old.priceDelta,
      stockDelta: old.stockDelta,
      changedAt: old.changedAt,
      updatedAt: old.updatedAt ?? now,
      notes: row.notes ?? old.notes,
      applicability: row.applicability ?? old.applicability,
      displayName: row.displayName ?? old.displayName,
    };
  });
  return { rows, changed };
}

export function catalogRowToOffer(supplier: Supplier, row: CatalogRow, now = new Date().toISOString()): Offer {
  const applicability =
    row.applicability ||
    row.specs?.["Применимость"] ||
    row.specs?.Применимость ||
    "";
  return applyPairFields({
    id: offerKey(supplier.id, row.guid || row.sku),
    supplierId: supplier.id,
    sku: row.sku,
    brand: row.brand,
    name: row.name,
    displayName: row.displayName ?? "",
    oem: row.oem,
    crossOems: row.crosses,
    category: row.category || applicability || "Расходники",
    price: row.price,
    currency: "RUB",
    stock: row.stock,
    warehouse: row.warehouse || supplier.name,
    multiplicity: row.multiplicity,
    deliveryDays: Number.isFinite(row.days) ? row.days : supplier.deliveryDaysMoscow || 0,
    guid: row.guid,
    stockId: row.stockId,
    vendorCode: row.vendor,
    specs: row.specs,
    images: row.images,
    notes: row.notes,
    applicability,
    prevPrice: row.prevPrice,
    prevStock: row.prevStock,
    priceDelta: row.priceDelta,
    stockDelta: row.stockDelta,
    changedAt: row.changedAt,
    updatedAt: row.updatedAt || now,
    source: "file",
  });
}

export function offerToCatalogRow(offer: Offer): CatalogRow {
  return {
    guid: offer.guid ?? "",
    sku: offer.sku,
    brand: offer.brand,
    name: offer.name,
    oem: offer.oem,
    price: offer.price,
    stock: offer.stock,
    days: offer.deliveryDays,
    multiplicity: offer.multiplicity,
    crosses: offer.crossOems ?? [],
    vendor: offer.vendorCode,
    stockId: offer.stockId,
    specs: offer.specs,
    images: offer.images,
    category: offer.category,
    warehouse: offer.warehouse,
    notes: offer.notes,
    applicability: offer.applicability,
    displayName: offer.displayName,
    prevPrice: offer.prevPrice,
    prevStock: offer.prevStock,
    priceDelta: offer.priceDelta,
    stockDelta: offer.stockDelta,
    changedAt: offer.changedAt,
    updatedAt: offer.updatedAt,
  };
}
