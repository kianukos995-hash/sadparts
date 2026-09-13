import { DEMO_KEYS } from "@/lib/constants";
import { CORE_PARTS, partPrice, partStock } from "@/lib/mock-parts";
import type { ColumnMap, Offer, StoreSnapshot, Supplier } from "@/lib/types";
import { DEFAULT_COLUMN_MAP } from "@/lib/types";
import { offerKey } from "@/lib/format";

const AUTOPITER_MAP: ColumnMap = {
  sku: "article",
  brand: "producer",
  name: "title",
  oem: "analog",
  category: "group",
  price: "cost",
  currency: "currency",
  stock: "qty",
  warehouse: "stockName",
  multiplicity: "pack",
};

const EXIST_MAP: ColumnMap = {
  sku: "Артикул",
  brand: "Бренд",
  name: "Наименование",
  oem: "OEM",
  category: "Категория",
  price: "Цена",
  currency: "Валюта",
  stock: "Остаток",
  warehouse: "Склад",
  multiplicity: "Кратность",
};

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function createDemoSuppliers(): Supplier[] {
  const createdAt = isoHoursAgo(72);
  return [
    {
      id: "sup-rossko",
      name: "Росско",
      code: "ROSSKO",
      source: "api",
      adapter: "demo",
      demoSlug: "rossko",
      apiUrl: "/api/mock-suppliers/rossko",
      apiKey: DEMO_KEYS.rossko,
      authMode: "header",
      authHeaderName: "X-Api-Key",
      authQueryParam: "apikey",
      itemsPath: "items",
      columnMap: { ...DEFAULT_COLUMN_MAP },
      notes: "Демо-коннектор. Формат JSON: items[]. Ключ передаётся заголовком X-Api-Key.",
      active: true,
      createdAt,
      lastSyncAt: isoHoursAgo(6),
      lastSyncStatus: "ok",
      lastSyncCount: 0,
    },
    {
      id: "sup-autopiter",
      name: "Автопитер",
      code: "APITER",
      source: "api",
      adapter: "demo",
      demoSlug: "autopiter",
      apiUrl: "/api/mock-suppliers/autopiter",
      apiKey: DEMO_KEYS.autopiter,
      authMode: "bearer",
      authHeaderName: "Authorization",
      authQueryParam: "token",
      itemsPath: "data.products",
      columnMap: AUTOPITER_MAP,
      notes: "Демо-коннектор. Вложенный JSON data.products, авторизация Bearer.",
      active: true,
      createdAt,
      lastSyncAt: isoHoursAgo(14),
      lastSyncStatus: "ok",
      lastSyncCount: 0,
    },
    {
      id: "sup-exist",
      name: "Exist Wholesale",
      code: "EXIST",
      source: "api",
      adapter: "demo",
      demoSlug: "exist",
      apiUrl: "/api/mock-suppliers/exist",
      apiKey: DEMO_KEYS.exist,
      authMode: "query",
      authHeaderName: "X-Api-Key",
      authQueryParam: "key",
      itemsPath: "",
      columnMap: EXIST_MAP,
      notes: "Демо-коннектор. Корневой массив с русскими полями, ключ в query.",
      active: true,
      createdAt,
      lastSyncAt: isoHoursAgo(30),
      lastSyncStatus: "ok",
      lastSyncCount: 0,
    },
    {
      id: "sup-file",
      name: "Прайс с диска",
      code: "FILE",
      source: "file",
      adapter: "generic",
      apiUrl: "",
      apiKey: "",
      authMode: "header",
      authHeaderName: "X-Api-Key",
      authQueryParam: "apikey",
      itemsPath: "items",
      columnMap: { ...DEFAULT_COLUMN_MAP },
      notes: "Поставщик без API — только загрузка CSV или Excel.",
      active: true,
      createdAt,
    },
  ];
}

function sliceForSupplier(supplierId: string): typeof CORE_PARTS {
  if (supplierId === "sup-rossko") return CORE_PARTS.filter((_, i) => i % 5 !== 0);
  if (supplierId === "sup-autopiter") return CORE_PARTS.filter((_, i) => i % 4 !== 3);
  return CORE_PARTS.filter((_, i) => i % 6 !== 1);
}

export function createDemoOffers(suppliers: Supplier[]): Offer[] {
  const configs = [
    { id: "sup-rossko", priceMul: 1, stockSeed: 1, warehouse: "МСК-Юг" },
    { id: "sup-autopiter", priceMul: 0.94, stockSeed: 3, warehouse: "СПБ-1" },
    { id: "sup-exist", priceMul: 1.07, stockSeed: 5, warehouse: "МСК-Север" },
  ];

  const offers: Offer[] = [];
  for (const config of configs) {
    const supplier = suppliers.find((item) => item.id === config.id);
    if (!supplier) continue;
    const updatedAt = supplier.lastSyncAt ?? new Date().toISOString();
    sliceForSupplier(config.id).forEach((part, index) => {
      const sku = part.sku.replace(/\s+/g, "").toUpperCase();
      offers.push({
        id: offerKey(config.id, sku),
        supplierId: config.id,
        sku,
        brand: part.brand,
        name: part.name,
        oem: part.oem,
        category: part.category,
        price: partPrice(part.basePrice, config.priceMul + (index % 3) * 0.01),
        currency: "RUB",
        stock: partStock(index + config.stockSeed),
        warehouse: config.warehouse,
        multiplicity: 1,
        updatedAt,
        source: "api",
      });
    });
  }
  return offers;
}

export function createInitialStore(): StoreSnapshot {
  const suppliers = createDemoSuppliers();
  const offers = createDemoOffers(suppliers);
  suppliers.forEach((supplier) => {
    const count = offers.filter((offer) => offer.supplierId === supplier.id).length;
    if (count) supplier.lastSyncCount = count;
  });
  return {
    version: 1,
    suppliers,
    offers,
    logs: suppliers
      .filter((supplier) => supplier.lastSyncAt)
      .map((supplier, index) => ({
        id: `log-seed-${index}`,
        supplierId: supplier.id,
        at: supplier.lastSyncAt ?? new Date().toISOString(),
        status: "ok" as const,
        imported: supplier.lastSyncCount ?? 0,
        source: supplier.source,
      })),
  };
}

export function rosskoPayload() {
  return {
    items: CORE_PARTS.filter((_, i) => i % 5 !== 0).map((part, index) => ({
      sku: part.sku,
      brand: part.brand,
      name: part.name,
      oem: part.oem,
      category: part.category,
      price: partPrice(part.basePrice, 1 + (index % 3) * 0.01),
      currency: "RUB",
      stock: partStock(index + 1),
      warehouse: "МСК-Юг",
      multiplicity: 1,
    })),
  };
}

export function autopiterPayload() {
  return {
    data: {
      products: CORE_PARTS.filter((_, i) => i % 4 !== 3).map((part, index) => ({
        article: part.sku,
        producer: part.brand,
        title: part.name,
        analog: part.oem,
        group: part.category,
        cost: partPrice(part.basePrice, 0.94 + (index % 3) * 0.01),
        currency: "RUB",
        qty: partStock(index + 3),
        stockName: "СПБ-1",
        pack: 1,
      })),
    },
  };
}

export function existPayload() {
  return CORE_PARTS.filter((_, i) => i % 6 !== 1).map((part, index) => ({
    Артикул: part.sku,
    Бренд: part.brand,
    Наименование: part.name,
    OEM: part.oem,
    Категория: part.category,
    Цена: partPrice(part.basePrice, 1.07 + (index % 3) * 0.01),
    Валюта: "RUB",
    Остаток: partStock(index + 5),
    Склад: "МСК-Север",
    Кратность: 1,
  }));
}
