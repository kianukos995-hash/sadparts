import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { normalizeSku, offerKey } from "@/lib/format";
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
}

interface CatalogIndex {
  rows: CatalogRow[];
  bySku: Map<string, number[]>;
  byOem: Map<string, number[]>;
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
  rows.forEach((row, index) => {
    addIndex(bySku, normalizeSku(row.sku.split("@")[0]), index);
    addIndex(bySku, normalizeSku(row.guid), index);
    if (row.vendor) addIndex(bySku, normalizeSku(row.vendor), index);
    addIndex(byOem, normalizeSku(row.oem), index);
    for (const cross of row.crosses) addIndex(byOem, normalizeSku(cross), index);
  });
  return { rows, bySku, byOem };
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
  return Array.from(ids)
    .slice(0, limit)
    .map((i) => catalogRowToOffer(supplier, index.rows[i], now));
}

export function catalogRowToOffer(supplier: Supplier, row: CatalogRow, now = new Date().toISOString()): Offer {
  return {
    id: offerKey(supplier.id, row.guid || row.sku),
    supplierId: supplier.id,
    sku: row.sku,
    brand: row.brand,
    name: row.name,
    displayName: "",
    oem: row.oem,
    crossOems: row.crosses,
    category: "Расходники",
    price: row.price,
    currency: "RUB",
    stock: row.stock,
    warehouse: "Росско",
    multiplicity: row.multiplicity,
    deliveryDays: Number.isFinite(row.days) ? row.days : supplier.deliveryDaysMoscow || 0,
    guid: row.guid,
    stockId: row.stockId,
    vendorCode: row.vendor,
    specs: row.specs,
    images: row.images,
    updatedAt: now,
    source: "file",
  };
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
  };
}
