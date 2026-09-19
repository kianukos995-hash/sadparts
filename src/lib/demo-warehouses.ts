import { EXAMPLE_ORG_ID } from "@/lib/constants";
import { mergeCrosses } from "@/lib/cross-catalog";
import { readCatalog, writeCatalog } from "@/lib/file-catalog";
import { normalizeSku, offerKey } from "@/lib/format";
import { CORE_PARTS, partPrice, partStock } from "@/lib/mock-parts";
import type { Offer, Order, OrderLine, Supplier } from "@/lib/types";

/** Только четыре демо-поставщика: не раздуваем сотню пресетов. */
export const DEMO_PRICE_SUPPLIER_IDS = ["sup-rossko", "sup-autopiter", "sup-exist", "sup-file"] as const;

/** Склады с разными сроками, остатком и ценой — чтобы в проценке было несколько строк на артикул. */
export const DEMO_WAREHOUSES = [
  { key: "msk-south", name: "МСК-Юг", days: 1, priceMul: 1, stockMul: 1 },
  { key: "msk-north", name: "МСК-Север", days: 2, priceMul: 1.03, stockMul: 0.7 },
  { key: "podolsk", name: "Подольск", days: 1, priceMul: 0.98, stockMul: 1.15 },
  { key: "spb-1", name: "СПБ-1", days: 2, priceMul: 0.94, stockMul: 0.9 },
  { key: "spb-2", name: "СПб-2", days: 4, priceMul: 1.05, stockMul: 0.45 },
  { key: "kazan", name: "Казань", days: 3, priceMul: 1.07, stockMul: 0.6 },
  { key: "ekb", name: "Екатеринбург", days: 3, priceMul: 1.04, stockMul: 0.75 },
  { key: "nsk", name: "Новосибирск", days: 5, priceMul: 1.12, stockMul: 0.4 },
  { key: "rnd", name: "Ростов", days: 4, priceMul: 1.08, stockMul: 0.55 },
  { key: "transit", name: "Транзит", days: 7, priceMul: 0.91, stockMul: 1.8 },
] as const;

const WAREHOUSES_BY_SUPPLIER: Record<(typeof DEMO_PRICE_SUPPLIER_IDS)[number], readonly (typeof DEMO_WAREHOUSES)[number]["key"][]> = {
  "sup-rossko": ["msk-south", "podolsk", "msk-north", "spb-2", "kazan", "ekb", "transit", "rnd"],
  "sup-autopiter": ["spb-1", "spb-2", "msk-south", "msk-north", "ekb", "nsk", "transit"],
  "sup-exist": ["msk-north", "msk-south", "kazan", "rnd", "nsk", "podolsk", "transit"],
  "sup-file": ["msk-south", "rnd", "nsk", "transit", "ekb", "kazan"],
};

const PRICE_MUL: Record<string, number> = {
  "sup-rossko": 1,
  "sup-autopiter": 0.94,
  "sup-exist": 1.07,
  "sup-file": 0.97,
};

const STOCK_SEED: Record<string, number> = {
  "sup-rossko": 1,
  "sup-autopiter": 3,
  "sup-exist": 5,
  "sup-file": 2,
};

function warehouseByKey(key: string) {
  return DEMO_WAREHOUSES.find((item) => item.key === key);
}

function partsFor(supplierId: string) {
  const sliced =
    supplierId === "sup-rossko"
      ? CORE_PARTS.filter((_, i) => i % 5 !== 0)
      : supplierId === "sup-autopiter"
        ? CORE_PARTS.filter((_, i) => i % 4 !== 3)
        : supplierId === "sup-file"
          ? CORE_PARTS.filter((_, i) => i % 3 !== 2)
          : CORE_PARTS.filter((_, i) => i % 6 !== 1);
  if (!sliced.some((part) => part.sku === CORE_PARTS[0].sku)) {
    return [CORE_PARTS[0], ...sliced];
  }
  return sliced;
}

function cloneOffer(base: Offer, warehouseKey: string, index: number, supplierId: string): Offer | null {
  const spec = warehouseByKey(warehouseKey);
  if (!spec) return null;
  const priceMul = PRICE_MUL[supplierId] ?? 1;
  const stockSeed = STOCK_SEED[supplierId] ?? 1;
  const stock = Math.max(
    warehouseKey === "podolsk" && index === 0 ? 0 : 1,
    Math.round(partStock(index + stockSeed) * spec.stockMul),
  );
  return {
    ...base,
    id: offerKey(supplierId, base.sku, spec.key),
    warehouse: spec.name,
    deliveryDays: spec.days,
    price: partPrice(base.price, spec.priceMul),
    stock: warehouseKey === "podolsk" && index === 0 ? 0 : stock,
  };
}

function offerFromPart(
  supplierId: string,
  part: (typeof CORE_PARTS)[number],
  index: number,
  warehouseKey: string,
  updatedAt: string,
  source: Offer["source"],
): Offer | null {
  const spec = warehouseByKey(warehouseKey);
  if (!spec) return null;
  const sku = normalizeSku(part.sku);
  const oem = normalizeSku(part.oem);
  const priceMul = PRICE_MUL[supplierId] ?? 1;
  const stockSeed = STOCK_SEED[supplierId] ?? 1;
  const stock = warehouseKey === "podolsk" && index === 0
    ? 0
    : Math.max(1, Math.round(partStock(index + stockSeed) * spec.stockMul));
  return {
    id: offerKey(supplierId, sku, spec.key),
    supplierId,
    sku,
    brand: part.brand,
    name: part.name,
    displayName: "",
    oem,
    crossOems: mergeCrosses(oem),
    category: part.category,
    price: partPrice(part.basePrice, priceMul * spec.priceMul + (index % 3) * 0.01),
    currency: "RUB",
    stock,
    warehouse: spec.name,
    multiplicity: 1,
    deliveryDays: spec.days,
    images: part.image ? [part.image] : undefined,
    updatedAt,
    source,
  };
}

export function buildDemoWarehouseOffers(suppliers: Supplier[], updatedAt = new Date().toISOString()): Offer[] {
  const offers: Offer[] = [];
  for (const id of DEMO_PRICE_SUPPLIER_IDS) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) continue;
    const keys = WAREHOUSES_BY_SUPPLIER[id];
    const source: Offer["source"] = id === "sup-file" ? "file" : "api";
    partsFor(id).forEach((part, index) => {
      for (const key of keys) {
        const offer = offerFromPart(id, part, index, key, supplier.lastSyncAt ?? updatedAt, source);
        if (offer) offers.push(offer);
      }
    });
  }
  return offers;
}

/** Дописывает недостающие склады к уже существующим позициям, без удаления пользовательских строк. */
export function expandDemoWarehouseOffers(offers: Offer[]): { offers: Offer[]; added: number } {
  const next = [...offers];
  const seen = new Set(offers.map((item) => item.id));
  let added = 0;
  for (const id of DEMO_PRICE_SUPPLIER_IDS) {
    const existing = offers.filter((item) => item.supplierId === id);
    if (existing.length === 0) {
      const generated = buildDemoWarehouseOffers([{ id } as Supplier]).filter((item) => item.supplierId === id);
      for (const offer of generated) {
        if (seen.has(offer.id)) continue;
        next.push(offer);
        seen.add(offer.id);
        added += 1;
      }
      continue;
    }
    const bySku = new Map<string, Offer[]>();
    for (const offer of existing) {
      const sku = normalizeSku(offer.sku.split("@")[0] ?? offer.sku);
      const list = bySku.get(sku) ?? [];
      list.push(offer);
      bySku.set(sku, list);
    }
    const keys = WAREHOUSES_BY_SUPPLIER[id];
    for (const [sku, rows] of bySku) {
      const warehouses = new Set(rows.map((item) => item.warehouse));
      if (warehouses.size >= 6) continue;
      const template = rows[0];
      keys.forEach((key, index) => {
        const spec = warehouseByKey(key);
        if (!spec) return;
        if (warehouses.has(spec.name)) return;
        const clone = cloneOffer(template, key, index, id);
        if (!clone || seen.has(clone.id)) return;
        clone.sku = sku;
        next.push(clone);
        seen.add(clone.id);
        warehouses.add(spec.name);
        added += 1;
      });
    }
  }
  return { offers: next, added };
}

export async function expandDemoWarehouseCatalogs(suppliers: Supplier[]) {
  let written = 0;
  for (const id of DEMO_PRICE_SUPPLIER_IDS) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) continue;
    const catalog = await readCatalog(id);
    if (catalog.rows.length === 0) continue;
    const bySku = new Map<string, typeof catalog.rows>();
    for (const row of catalog.rows) {
      const sku = normalizeSku(row.sku.split("@")[0] ?? row.sku);
      const list = bySku.get(sku) ?? [];
      list.push(row);
      bySku.set(sku, list);
    }
    const keys = WAREHOUSES_BY_SUPPLIER[id];
    const extra: typeof catalog.rows = [];
    for (const rows of bySku.values()) {
      const names = new Set(rows.map((item) => item.warehouse || ""));
      if (names.size >= 6) continue;
      const template = rows[0];
      for (const key of keys) {
        const spec = warehouseByKey(key);
        if (!spec || names.has(spec.name)) continue;
        extra.push({
          ...template,
          stockId: spec.key,
          warehouse: spec.name,
          days: spec.days,
          price: Math.round(template.price * spec.priceMul),
          stock: Math.max(1, Math.round((template.stock || 4) * spec.stockMul)),
        });
        names.add(spec.name);
      }
    }
    if (extra.length === 0) continue;
    await writeCatalog(id, [...catalog.rows, ...extra]);
    written += extra.length;
  }
  return written;
}

function staleLine(partial: Partial<OrderLine> & Pick<OrderLine, "sku" | "offerId" | "supplierId">): OrderLine {
  return {
    id: partial.id ?? `line-${partial.sku}`,
    offerId: partial.offerId,
    supplierId: partial.supplierId,
    sku: partial.sku,
    brand: partial.brand ?? "BOSCH",
    name: partial.name ?? "Позиция для перепроценки",
    oem: partial.oem ?? "",
    qty: partial.qty ?? 12,
    buyPrice: partial.buyPrice ?? 100,
    currency: "RUB",
    deliveryDays: partial.deliveryDays ?? 1,
    warehouse: partial.warehouse ?? "Старый склад",
    snapshotSell: partial.snapshotSell ?? 140,
    snapshotStock: partial.snapshotStock ?? 80,
    snapshotAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Черновики с устаревшим снимком, чтобы у ролей была перепроценка без сброса store. */
export function createDemoRepriceOrders(): Order[] {
  const now = new Date().toISOString();
  const bosch = CORE_PARTS[0];
  return [
    {
      id: "ord-reprice-sto",
      number: "ЗК-0901",
      status: "draft",
      clientId: "cli-sto",
      markupPercent: 16,
      comment: "Демо: остаток и склад не совпадают с прайсом.",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "usr-sto",
      lines: [
        staleLine({
          id: "line-sto-stock",
          sku: bosch.sku,
          brand: bosch.brand,
          name: bosch.name,
          oem: bosch.oem,
          offerId: "sup-rossko:0986424811:missing-wh",
          supplierId: "sup-rossko",
          qty: 40,
          snapshotStock: 80,
          warehouse: "Старый склад",
        }),
        staleLine({
          id: "line-sto-gone",
          sku: "NO-SUCH-SKU",
          brand: "ATE",
          name: "Позиции больше нет в прайсе",
          offerId: "gone-offer",
          supplierId: "sup-rossko",
          qty: 2,
        }),
      ],
    },
    {
      id: "ord-reprice-org",
      number: "ЗК-0902",
      status: "draft",
      clientId: "",
      organizationId: EXAMPLE_ORG_ID,
      markupPercent: 14,
      comment: "Демо-черновик организации: нужна перепроценка.",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "usr-org",
      lines: [
        staleLine({
          id: "line-org-stock",
          sku: bosch.sku,
          brand: bosch.brand,
          name: bosch.name,
          oem: bosch.oem,
          offerId: "sup-autopiter:0986424811:old",
          supplierId: "sup-autopiter",
          qty: 25,
          snapshotStock: 90,
        }),
      ],
    },
    {
      id: "ord-reprice-mgr",
      number: "ЗК-0903",
      status: "draft",
      clientId: "",
      organizationId: EXAMPLE_ORG_ID,
      markupPercent: 14,
      comment: "Демо-черновик менеджера.",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "usr-manager",
      lines: [
        staleLine({
          id: "line-mgr-sku",
          sku: bosch.sku,
          brand: bosch.brand,
          name: bosch.name,
          oem: bosch.oem,
          offerId: "sup-exist:0986424811:old",
          supplierId: "sup-exist",
          qty: 18,
          snapshotStock: 50,
        }),
      ],
    },
  ];
}

export function mergeDemoRepriceOrders(orders: Order[]): Order[] {
  const extras = createDemoRepriceOrders();
  const have = new Set(orders.map((item) => item.id));
  const add = extras.filter((item) => !have.has(item.id));
  return add.length ? [...orders, ...add] : orders;
}
