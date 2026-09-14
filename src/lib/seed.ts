import { DEMO_KEYS, DEMO_LOGIN_KEY, EXAMPLE_ORG_ID, ROSSKO_API_BASE, STORE_VERSION } from "@/lib/constants";
import { mergeCrosses } from "@/lib/cross-catalog";
import { offerKey } from "@/lib/format";
import { CORE_PARTS, partPrice, partStock } from "@/lib/mock-parts";
import type { Client, ColumnMap, Offer, Organization, StoreSnapshot, Supplier } from "@/lib/types";
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
    fio: "Розничный покупатель",
    phone: "",
    inn: "",
    discountPercent: 0,
    notes: "Базовая цена склада с наценкой, скидка 0%.",
    createdAt: "2026-03-01T09:00:00.000Z",
    ownerUserId: "usr-admin",
    issuedByUserId: "usr-admin",
  },
  {
    id: "cli-sto",
    name: "СТО Север",
    fio: "Иванов Сергей Петрович",
    phone: "+7 495 120-40-18",
    inn: "7701234567",
    discountPercent: 8,
    markupPercent: 16,
    email: "sto@sadparts.local",
    accessKey: "SP-TEST-4812",
    accountStatus: "active",
    priceView: "clean",
    notes: "Постоянный клиент, скидка 8% от цены с наценкой.",
    createdAt: "2026-03-12T09:00:00.000Z",
    telegramChatId: "",
    car: "Audi A4",
    carMake: "Audi",
    carModel: "A4",
    vin: "WAUZZZ8K9BA123456",
    plate: "А123АА777",
    year: "2012",
    color: "чёрный",
    ownerUserId: "usr-sto",
    issuedByUserId: "usr-admin",
  },
  {
    id: "cli-key-demo",
    name: "Ключ-демо",
    fio: "Клюева Дарья Игоревна",
    phone: "+7 495 000-11-22",
    inn: "",
    discountPercent: 5,
    markupPercent: 16,
    email: "keydemo@sadparts.local",
    accessKey: DEMO_LOGIN_KEY,
    accountStatus: "active",
    priceView: "clean",
    notes: `Демо-вход по ключу ${DEMO_LOGIN_KEY}. Не гость по устройству.`,
    createdAt: "2026-06-01T09:00:00.000Z",
    car: "Kia Rio",
    carMake: "Kia",
    carModel: "Rio",
    vin: "XWEPH81ABD0001234",
    plate: "К001КК777",
    year: "2019",
    color: "белый",
    ownerUserId: "usr-key-demo",
    issuedByUserId: "usr-admin",
  },
  {
    id: "cli-opt",
    name: "Опт Юг",
    fio: "Петрова Мария",
    phone: "+7 495 331-09-44",
    inn: "7720981120",
    discountPercent: 15,
    notes: "Оптовая скидка 15%. Карточка администратора, не организации.",
    createdAt: "2026-04-02T09:00:00.000Z",
    ownerUserId: "usr-admin",
    issuedByUserId: "usr-admin",
  },
  {
    id: "cli-guest",
    name: "Гость",
    phone: "",
    inn: "",
    email: "guest@sadparts.local",
    discountPercent: 0,
    priceView: "clean",
    accountStatus: "active",
    notes: "Шаблон гостевого входа. Живые гости получают отдельную карточку.",
    createdAt: "2026-03-01T09:00:00.000Z",
    ownerUserId: "usr-admin",
  },
];

export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: EXAMPLE_ORG_ID,
    name: "Пример организации",
    inn: "",
    phone: "",
    email: "org@sadparts.local",
    notes: "Пустой пример. Список клиентов организации специально пуст — можно удалить.",
    createdAt: "2026-05-01T09:00:00.000Z",
    createdByUserId: "usr-admin",
    discountPercent: 5,
    markupPercent: 14,
    maxMarkup: 28,
    accessKey: "SP-ORG-DEMO1",
    accountStatus: "active",
    priceView: "clean",
    managersCanEditSuppliers: false,
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
      adapter: "rossko",
      demoSlug: "rossko",
      apiUrl: ROSSKO_API_BASE,
      apiKey: DEMO_KEYS.rossko,
      apiKey2: DEMO_KEYS.rossko2,
      authMode: "header",
      authHeaderName: "X-Api-Key",
      authQueryParam: "apikey",
      itemsPath: "items",
      columnMap: { ...DEFAULT_COLUMN_MAP },
      notes:
        "SOAP v2.1: GetSearch, GetCheckoutDetails, GetCheckout, GetOrders. KEY1 и KEY2 из кабинета. v1 msk.rossko.ru закрыт. Прайс ZIP/CSV кладётся в файловый каталог.",
      active: true,
      createdAt,
      deliveryDaysMoscow: 1,
      deliveryNote: "Склад Подольск. До Москвы обычно на следующий рабочий день.",
      lastSyncAt: isoHoursAgo(6),
      lastSyncStatus: "ok",
      lastSyncCount: 0,
      ownerRole: "admin",
      lockedByAdmin: true,
      sharedWithOrgIds: [EXAMPLE_ORG_ID],
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
      apiKey2: "",
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
      ownerRole: "admin",
      lockedByAdmin: true,
      sharedWithOrgIds: [EXAMPLE_ORG_ID],
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
      apiKey2: "",
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
      ownerRole: "admin",
      lockedByAdmin: true,
      sharedWithOrgIds: [EXAMPLE_ORG_ID],
    },
    {
      id: "sup-file",
      name: "Прайс с диска",
      code: "FILE",
      source: "file",
      adapter: "generic",
      apiUrl: "",
      apiKey: "",
      apiKey2: "",
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
      ownerRole: "admin",
      lockedByAdmin: true,
      sharedWithOrgIds: [EXAMPLE_ORG_ID],
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
        images: part.image ? [part.image] : undefined,
        updatedAt,
        source: "api",
      });
      if (config.id === "sup-rossko" && index === 0) {
        offers.push({
          id: offerKey(config.id, sku, "podolsk"),
          supplierId: config.id,
          sku,
          brand: part.brand,
          name: part.name,
          displayName: "",
          oem,
          crossOems: mergeCrosses(oem),
          category: part.category,
          price: partPrice(part.basePrice, config.priceMul + 0.02),
          currency: "RUB",
          stock: 0,
          warehouse: "Подольск",
          multiplicity: 1,
          deliveryDays: 2,
          images: part.image ? [part.image] : undefined,
          updatedAt,
          source: "api",
        });
        offers.push({
          id: offerKey(config.id, sku, "spb2"),
          supplierId: config.id,
          sku,
          brand: part.brand,
          name: part.name,
          displayName: "",
          oem,
          crossOems: mergeCrosses(oem),
          category: part.category,
          price: partPrice(part.basePrice, config.priceMul + 0.04),
          currency: "RUB",
          stock: 6,
          warehouse: "СПб-2",
          multiplicity: 1,
          deliveryDays: 4,
          images: part.image ? [part.image] : undefined,
          updatedAt,
          source: "api",
        });
      }
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
    moneyMovements: [],
    supplierBills: [],
    organizations: DEFAULT_ORGANIZATIONS,
    purchases: [],
    warehouseLots: [],
    warehouseDocs: [],
    managerMemberships: [
      {
        id: "mem-usr-manager",
        userId: "usr-manager",
        organizationId: EXAMPLE_ORG_ID,
        incomePercent: 5,
        incomeFixed: 50,
        shiftRate: 2500,
        createdAt: "2026-05-01T09:00:00.000Z",
        updatedAt: "2026-05-01T09:00:00.000Z",
      },
    ],
    scheduleDays: [],
    scheduleArchives: [],
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
