import type { ColumnMap, FieldKey, Offer, Supplier } from "@/lib/types";
import { DEFAULT_COLUMN_MAP, FIELD_KEYS } from "@/lib/types";
import { mergeCrosses } from "@/lib/cross-catalog";
import { normalizeSku, offerKey } from "@/lib/format";
import { stringifyCell } from "@/lib/json-path";
import { extractSpecs } from "@/lib/specs";
import { collectRowImages } from "@/lib/media";

const ALIASES: Record<FieldKey, string[]> = {
  sku: ["артикул", "partnumber", "sku", "article", "каталожныйномер", "код", "partno", "pn", "номердетали"],
  brand: ["brand", "бренд", "производитель", "make", "producer", "manufacturer", "марка"],
  name: ["описание", "name", "наименование", "название", "title", "desc", "товар"],
  oem: ["оемномер", "oemномер", "oem", "оригинал", "ориг", "oe", "oeномер"],
  category: ["category", "категория", "группа", "group", "раздел", "применимость"],
  price: ["ценаруб", "price", "цена", "cost", "стоимость", "закуп", "ценазакупки", "ценазакуп", "optprice"],
  currency: ["currency", "валюта"],
  stock: ["наличие", "stock", "остаток", "qty", "quantity", "count", "количество", "остатки"],
  warehouse: ["warehouse", "склад", "stockname", "филиал", "складпоставщика"],
  multiplicity: ["кратностьотгрузки", "multiplicity", "кратность", "min_order", "кратно", "минпартия"],
  deliveryDays: ["срокпоставкидн", "deliverydays", "срок", "срокдоставки", "days", "delivery", "leadtime", "срокдн"],
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s._-]+/g, "");
}

export function matchHeader(headers: string[], column: string) {
  if (!column) return undefined;
  const key = normalizeHeader(column);
  return headers.find((header) => normalizeHeader(header) === key);
}

export function resolveColumnMap(
  headers: string[],
  saved?: Partial<ColumnMap> | null,
  extra?: Partial<ColumnMap> | null,
): { map: ColumnMap; usedSaved: FieldKey[]; usedExtra: FieldKey[]; guessed: FieldKey[] } {
  const map = guessColumnMap(headers);
  const usedSaved: FieldKey[] = [];
  const usedExtra: FieldKey[] = [];

  function overlay(partial: Partial<ColumnMap> | null | undefined, bucket: FieldKey[]) {
    if (!partial) return;
    for (const field of FIELD_KEYS) {
      const hit = matchHeader(headers, partial[field] ?? "");
      if (!hit) continue;
      map[field] = hit;
      bucket.push(field);
    }
  }

  overlay(saved, usedSaved);
  overlay(extra, usedExtra);
  const locked = new Set<FieldKey>([...usedSaved, ...usedExtra]);
  return {
    map,
    usedSaved,
    usedExtra,
    guessed: FIELD_KEYS.filter((field) => !locked.has(field) && Boolean(map[field])),
  };
}

export function describeColumnMap(map: ColumnMap) {
  return FIELD_KEYS.filter((field) => map[field])
    .map((field) => `${field}←${map[field]}`)
    .join(", ");
}

export function guessColumnMap(headers: string[]): ColumnMap {
  if (isRosskoPriceHeaders(headers)) return rosskoFileColumnMap(headers);
  const map = { ...DEFAULT_COLUMN_MAP };
  const normalized = headers.map((header) => ({
    raw: header,
    key: normalizeHeader(header),
  }));

  (Object.keys(ALIASES) as FieldKey[]).forEach((field) => {
    let best: { raw: string; score: number } | undefined;
    for (const header of normalized) {
      for (const alias of ALIASES[field]) {
        const key = normalizeHeader(alias);
        let score = 0;
        if (header.key === key) score = 3;
        else if (header.key.startsWith(key) || key.startsWith(header.key)) score = 2;
        else if (key.length >= 5 && header.key.includes(key)) score = 1;
        if (score && (!best || score > best.score)) best = { raw: header.raw, score };
      }
    }
    if (best) map[field] = best.raw;
  });

  return map;
}

export function isRosskoPriceHeaders(headers: string[]) {
  const keys = headers.map(normalizeHeader);
  return keys.some((key) => key.includes("номенклатура")) && keys.some((key) => key === "артикул");
}

export function rosskoFileColumnMap(headers: string[]): ColumnMap {
  const byKey = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const pick = (...needles: string[]) => {
    for (const needle of needles) {
      const hit = byKey.get(normalizeHeader(needle));
      if (hit) return hit;
      const includes = headers.find((header) => normalizeHeader(header).includes(normalizeHeader(needle)));
      if (includes) return includes;
    }
    return "";
  };
  return {
    sku: pick("Артикул"),
    brand: pick("Бренд"),
    name: pick("Описание"),
    oem: pick("OEМ Номер", "OEM Номер", "OEM"),
    category: pick("Применимость"),
    price: pick("Цена, руб."),
    currency: "",
    stock: pick("Наличие"),
    warehouse: "",
    multiplicity: pick("Кратность отгрузки"),
    deliveryDays: pick("Срок поставки, дн."),
  };
}

function readField(row: Record<string, unknown>, column: string) {
  if (!column) return "";
  if (column in row) return stringifyCell(row[column]);
  const match = Object.keys(row).find(
    (key) => normalizeHeader(key) === normalizeHeader(column),
  );
  return match ? stringifyCell(row[match]) : "";
}

function parseNumber(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseOptionalNumber(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function parseStock(value: string) {
  const range = value.replace(/\s/g, "").match(/^(\d+)(?:-\d+)?$/);
  if (range) return Number.parseInt(range[1], 10);
  return Math.max(0, Math.round(parseNumber(value)));
}

export function rowToOffer(
  row: Record<string, unknown>,
  supplier: Supplier,
  columnMap: ColumnMap,
  now = new Date().toISOString(),
): Offer | null {
  const sku = normalizeSku(readField(row, columnMap.sku));
  if (!sku) return null;
  const name = readField(row, columnMap.name) || sku;
  const price = parseNumber(readField(row, columnMap.price));
  const stock = parseStock(readField(row, columnMap.stock));
  const multiplicity = Math.max(
    1,
    Math.round(parseNumber(readField(row, columnMap.multiplicity)) || 1),
  );

  const deliveryFromRow = parseOptionalNumber(readField(row, columnMap.deliveryDays));
  const crossRaw = ["cross", "кросс", "analogs", "analogues", "crosses"]
    .map((key) => readField(row, key))
    .filter(Boolean)
    .join(";");
  const crosses = crossRaw
    .split(/[;,]/)
    .map((item) => normalizeSku(item))
    .filter(Boolean);
  const guid = normalizeSku(
    readField(row, "Номенклатура") || readField(row, "guid") || readField(row, "GUID"),
  );
  const vendor = normalizeSku(
    readField(row, "Вендор-код") || readField(row, "vendor") || readField(row, "vendorcode"),
  );
  const catalogNumber = normalizeSku(readField(row, "Каталожный номер"));
  const stockId = readField(row, "stock") || readField(row, "id") || readField(row, "StockID");
  const checkoutSku = vendor && vendor !== sku && !sku.includes("@") ? `${sku}@${vendor}` : sku;
  const oem = normalizeSku(readField(row, columnMap.oem) || catalogNumber);

  return {
    id: offerKey(supplier.id, guid || checkoutSku, stockId),
    supplierId: supplier.id,
    sku: checkoutSku,
    brand: readField(row, columnMap.brand) || "—",
    name,
    displayName: "",
    oem,
    crossOems: mergeCrosses(oem, crosses),
    category: readField(row, columnMap.category) || "Расходники",
    price,
    currency: readField(row, columnMap.currency) || "RUB",
    stock,
    warehouse: readField(row, columnMap.warehouse) || readField(row, "description") || stockId,
    multiplicity,
    deliveryDays:
      deliveryFromRow === undefined ? supplier.deliveryDaysMoscow || 2 : Math.max(0, Math.round(deliveryFromRow)),
    guid,
    stockId: stockId || undefined,
    vendorCode: vendor || undefined,
    specs: extractSpecs(row, columnMap),
    images: collectRowImages(row).images,
    updatedAt: now,
    source: supplier.source,
  };
}

export function mapPayloadToOffers(
  items: unknown[],
  supplier: Supplier,
): { offers: Offer[]; skipped: number } {
  const now = new Date().toISOString();
  const offers: Offer[] = [];
  let skipped = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") {
      skipped += 1;
      continue;
    }
    const offer = rowToOffer(item as Record<string, unknown>, supplier, supplier.columnMap, now);
    if (!offer) {
      skipped += 1;
      continue;
    }
    offers.push(offer);
  }
  return { offers, skipped };
}
