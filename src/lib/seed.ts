import { DEMO_KEYS, STORE_VERSION } from "@/lib/constants";
import { mergeCrosses } from "@/lib/cross-catalog";
import { offerKey } from "@/lib/format";
import { CORE_PARTS, partPrice, partStock } from "@/lib/mock-parts";
import type { Client, ColumnMap, Offer, StoreSnapshot, Supplier } from "@/lib/types";
import { DEFAULT_COLUMN_MAP } from "@/lib/types";

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
  deliveryDays: "delivery",
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
  deliveryDays: "Срок",
};

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export const DEFAULT_CLIENTS: Client[] = [
  {
    id: "cli-cash",
    name: "Розница",
    phone: "",
    inn: "",
    discountPercent: 0,
    notes: "Базовая цена склада с наценкой, скидка 0%.",
    createdAt: "2026-03-01T09:00:00.000Z",
  },
  {
    id: "cli-sto",
    name: "СТО Север",
    phone: "+7 495 120-40-18",
    inn: "7701234567",
    discountPercent: 8,
    notes: "Постоянный клиент, скидка 8% от цены с наценкой.",
    createdAt: "2026-03-12T09:00:00.000Z",
  },
  {
    id: "cli-opt",
    name: "Опт Юг",
    phone: "+7 495 331-09-44",
    inn: "7720981120",
    discountPercent: 15,
    notes: "Оптовая скидка 15%.",
    createdAt: "2026-04-02T09:00:00.000Z",
  },
];

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
      deliveryDaysMoscow: 1,
      deliveryNote: "Склад Подольск. До Москвы обычно на следующий рабочий день.",
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
      deliveryDaysMoscow: 2,
      deliveryNote: "Склад СПб. До Москвы 1–2 дня, экспресс — ночь.",
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
      deliveryDaysMoscow: 3,
      deliveryNote: "Региональный склад. До Москвы 2–4 дня.",
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
      deliveryDaysMoscow: 5,
      deliveryNote: "Самовывоз / ТК. До Москвы обычно 4–6 дней после отгрузки.",
    },
  ];
}

function sliceForSupplier(supplierId: string): typeof CORE_PARTS {
  if (supplierId === "sup-rossko") return CORE_PARTS.filter((_, i) => i % 5 !== 0);
  if (supplierId === "sup-autopiter") return CORE_PARTS.filter((_, i) => i % 4 !== 3);
  return CORE_PARTS.filter((_, i) => i % 6 !== 1);
}

const EXTRA_ANALOGS: Offer[] = [
  {
    id: offerKey("sup-rossko", "13.0460-7215.2"),
    supplierId: "sup-rossko",
    sku: "13.0460-7215.2",
    brand: "ATE",
    name: "Колодки тормозные передние (кросс OEM)",
    displayName: "",
    oem: "4E0698151B",
    crossOems: ["4E0698151C"],
    category: "Тормозная система",
    price: 4510,
    currency: "RUB",
    stock: 9,
    warehouse: "МСК-Юг",
    multiplicity: 1,
    deliveryDays: 1,
    updatedAt: isoHoursAgo(5),
    source: "api",
  },
  {
    id: offerKey("sup-exist", "24.0122-0165.1"),
    supplierId: "sup-exist",
    sku: "24.0122-0165.1",
    brand: "ATE",
    name: "Диск тормозной вентилируемый",
    displayName: "",
    oem: "4E0615301E",
    crossOems: ["8E0615301P"],
    category: "Тормозная система",
    price: 4980,
    currency: "RUB",
    stock: 4,
    warehouse: "МСК-Север",
    multiplicity: 1,
    deliveryDays: 3,
    updatedAt: isoHoursAgo(28),
    source: "api",
  },
];

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
      const oem = part.oem.replace(/\s+/g, "").toUpperCase();
      offers.push({
        id: offerKey(config.id, sku),
        supplierId: config.id,
        sku,
        brand: part.brand,
        name: part.name,
        displayName: "",
        oem,
        crossOems: mergeCrosses(oem),
        category: part.category,
        price: partPrice(part.basePrice, config.priceMul + (index % 3) * 0.01),
        currency: "RUB",
        stock: partStock(index + config.stockSeed),
        warehouse: config.warehouse,
        multiplicity: 1,
        deliveryDays: supplier.deliveryDaysMoscow,
        updatedAt,
        source: "api",
      });
    });
  }
  return [...offers, ...EXTRA_ANALOGS];
}

export function createInitialStore(): StoreSnapshot {
  const suppliers = createDemoSuppliers();
  const offers = createDemoOffers(suppliers);
  suppliers.forEach((supplier) => {
    const count = offers.filter((offer) => offer.supplierId === supplier.id).length;
    if (count) supplier.lastSyncCount = count;
  });
  return {
    version: STORE_VERSION,
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
    clients: DEFAULT_CLIENTS,
    orders: [],
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
      deliveryDays: 1,
      cross: mergeCrosses(part.oem).join(";"),
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
        delivery: 2,
        cross: mergeCrosses(part.oem).join(";"),
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
    Срок: 3,
    Кросс: mergeCrosses(part.oem).join(";"),
  }));
}
