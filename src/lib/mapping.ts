import type { ColumnMap, FieldKey, Offer, Supplier } from "@/lib/types";
import { DEFAULT_COLUMN_MAP } from "@/lib/types";
import { normalizeSku, offerKey } from "@/lib/format";
import { stringifyCell } from "@/lib/json-path";

const ALIASES: Record<FieldKey, string[]> = {
  sku: ["sku", "артикул", "art", "article", "номер", "код", "cat_number", "каталожный"],
  brand: ["brand", "бренд", "производитель", "make", "producer", "manufacturer"],
  name: ["name", "наименование", "название", "title", "описание", "desc"],
  oem: ["oem", "оригинал", "ориг", "oe", "номер_производителя", "analog"],
  category: ["category", "категория", "группа", "group", "раздел"],
  price: ["price", "цена", "cost", "руб", "стоимость"],
  currency: ["currency", "валюта"],
  stock: ["stock", "остаток", "наличие", "qty", "quantity", "count", "кол-во"],
  warehouse: ["warehouse", "склад", "stockname", "филиал"],
  multiplicity: ["multiplicity", "кратность", "min_order", "кратно"],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s._-]+/g, "");
}

export function guessColumnMap(headers: string[]): ColumnMap {
  const map = { ...DEFAULT_COLUMN_MAP };
  const normalized = headers.map((header) => ({
    raw: header,
    key: normalizeHeader(header),
  }));

  (Object.keys(ALIASES) as FieldKey[]).forEach((field) => {
    const hit = normalized.find((header) =>
      ALIASES[field].some((alias) => header.key.includes(normalizeHeader(alias))),
    );
    if (hit) map[field] = hit.raw;
  });

  return map;
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
  const stock = Math.max(0, Math.round(parseNumber(readField(row, columnMap.stock))));
  const multiplicity = Math.max(
    1,
    Math.round(parseNumber(readField(row, columnMap.multiplicity)) || 1),
  );

  return {
    id: offerKey(supplier.id, sku),
    supplierId: supplier.id,
    sku,
    brand: readField(row, columnMap.brand) || "—",
    name,
    oem: normalizeSku(readField(row, columnMap.oem)),
    category: readField(row, columnMap.category) || "Расходники",
    price,
    currency: readField(row, columnMap.currency) || "RUB",
    stock,
    warehouse: readField(row, columnMap.warehouse),
    multiplicity,
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
