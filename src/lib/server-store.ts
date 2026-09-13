import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_KEYS, ROSSKO_API_BASE, STORE_VERSION } from "@/lib/constants";
import { mergeCrosses } from "@/lib/cross-catalog";
import type { OfferPatch } from "@/lib/offer-patches";
import { normalizeSku } from "@/lib/format";
import { removeCatalog } from "@/lib/file-catalog";
import { CORE_PARTS } from "@/lib/mock-parts";
import { createInitialStore, DEFAULT_CLIENTS } from "@/lib/seed";
import { DEFAULT_PRICE_BANDS, sanitizeBands } from "@/lib/price-bands";
import { defaultGuestBands } from "@/lib/roles";
import {
  nextBillNumber,
  roundCash,
  syncOrderPaidAmounts,
} from "@/lib/money";
import type {
  AppSettings,
  Client,
  ImportMode,
  MoneyMovement,
  Offer,
  Order,
  PaymentMethod,
  StoreSnapshot,
  Supplier,
  SupplierBill,
  SyncLog,
} from "@/lib/types";
import { DEFAULT_COLUMN_MAP } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export const EMPTY_SETTINGS: AppSettings = {
  telegramToken: "",
  telegramUsername: "",
  telegramPolling: true,
  telegramOffset: 0,
  telegramSecret: "",
  markupPercent: 18,
  moscowHubNote: "Срок до Москвы считается от склада поставщика + 1 день на хаб.",
  priceBands: DEFAULT_PRICE_BANDS,
  sellerTitle: "ИП Блажиевский Олег Владимирович, ИНН 622602703211",
  sellerAddress: "391001, Рязанская обл, Клепиковский р-н, рп Тума",
  vatPercent: 0,
  telegramNotifyChatId: "",
  telegramChats: [],
  guestPriceBands: defaultGuestBands(),
  managerPriceBands: DEFAULT_PRICE_BANDS,
};

const DEFAULT_DELIVERY: Record<string, { days: number; note: string }> = {
  "sup-rossko": {
    days: 1,
    note: "Склад Подольск. До Москвы обычно на следующий рабочий день.",
  },
  "sup-autopiter": { days: 2, note: "Склад СПб. До Москвы 1–2 дня, экспресс — ночь." },
  "sup-exist": { days: 3, note: "Региональный склад. До Москвы 2–4 дня." },
  "sup-file": { days: 5, note: "Самовывоз / ТК. До Москвы обычно 4–6 дней после отгрузки." },
};

let storeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>) {
  const run = storeQueue.then(work, work);
  storeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isStore(value: unknown): value is StoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as StoreSnapshot;
  return (
    Array.isArray(candidate.suppliers) &&
    Array.isArray(candidate.offers) &&
    Array.isArray(candidate.logs)
  );
}

function migrateStore(store: StoreSnapshot): StoreSnapshot {
  const suppliers = store.suppliers.map((supplier) => {
    const fallback = DEFAULT_DELIVERY[supplier.id];
    const rossko = supplier.id === "sup-rossko" || supplier.demoSlug === "rossko";
    return {
      ...supplier,
      apiKey2: supplier.apiKey2 ?? (rossko ? DEMO_KEYS.rossko2 : ""),
      adapter: rossko ? "rossko" : supplier.adapter,
      apiUrl: rossko ? ROSSKO_API_BASE : supplier.apiUrl,
      deliveryDaysMoscow: supplier.deliveryDaysMoscow ?? fallback?.days ?? 2,
      deliveryNote: supplier.deliveryNote ?? fallback?.note ?? "",
      columnMap: { ...DEFAULT_COLUMN_MAP, ...supplier.columnMap },
    };
  });
  const supplierDays = new Map(suppliers.map((item) => [item.id, item.deliveryDaysMoscow]));
  const demoPhotos = new Map(
    CORE_PARTS.filter((part) => part.image).map((part) => [normalizeSku(part.sku), part.image!]),
  );
  const offers = store.offers.map((offer) => {
    const demoPhoto = demoPhotos.get(normalizeSku(offer.sku.split("@")[0] ?? offer.sku));
    return {
      ...offer,
      displayName: offer.displayName ?? "",
      crossOems: mergeCrosses(offer.oem, offer.crossOems ?? []),
      deliveryDays: Number.isFinite(offer.deliveryDays)
        ? offer.deliveryDays
        : supplierDays.get(offer.supplierId) || 2,
      images: offer.images?.length ? offer.images : demoPhoto ? [demoPhoto] : offer.images,
    };
  });
  const moneyMovements = Array.isArray(store.moneyMovements)
    ? store.moneyMovements.map(normalizeMovement)
    : [];
  const supplierBills = Array.isArray(store.supplierBills)
    ? store.supplierBills.map(normalizeBill)
    : [];
  const orders = dedupeOrders(Array.isArray(store.orders) ? store.orders : []);
  let clients = Array.isArray(store.clients) ? store.clients : DEFAULT_CLIENTS;
  if (!clients.some((item) => item.id === "cli-guest")) {
    clients = [
      ...clients,
      {
        id: "cli-guest",
        name: "Гость",
        phone: "",
        inn: "",
        email: "guest@sadparts.local",
        discountPercent: 0,
        priceView: "clean",
        accountStatus: "active",
        notes: "Гостевой вход: рыночная наценка без скидки.",
        createdAt: "2026-03-01T09:00:00.000Z",
      },
    ];
  }
  clients = clients.map((client) => {
    if (client.id === "cli-sto") {
      return {
        ...client,
        email: client.email || "sto@sadparts.local",
        accessKey: client.accessKey || "SP-TEST-4812",
        markupPercent: client.markupPercent ?? 16,
        accountStatus: "active",
        priceView: client.priceView ?? "clean",
      };
    }
    return client;
  });
  return {
    ...store,
    version: STORE_VERSION,
    suppliers,
    offers,
    clients,
    orders: syncOrderPaidAmounts(orders, moneyMovements),
    moneyMovements,
    supplierBills,
  };
}

const PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "card", "cashless"]);

function normalizeMovement(item: MoneyMovement): MoneyMovement {
  const method = PAYMENT_METHODS.has(item.method) ? item.method : "cash";
  const direction = item.direction === "expense" ? "expense" : "income";
  return {
    id: item.id,
    at: item.at || item.createdAt || new Date().toISOString(),
    amount: roundCash(Number(item.amount) || 0),
    method,
    direction,
    counterparty: item.counterparty?.trim() ?? "",
    comment: item.comment?.trim() ?? "",
    clientId: item.clientId || undefined,
    orderId: item.orderId || undefined,
    supplierId: item.supplierId || undefined,
    supplierBillId: item.supplierBillId || undefined,
    createdAt: item.createdAt || item.at || new Date().toISOString(),
  };
}

function normalizeBill(item: SupplierBill): SupplierBill {
  return {
    id: item.id,
    number: item.number?.trim() || nextBillNumber([]),
    supplierId: item.supplierId,
    amount: roundCash(Number(item.amount) || 0),
    comment: item.comment?.trim() ?? "",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

function withMoney(store: StoreSnapshot, patch: Partial<StoreSnapshot>): StoreSnapshot {
  const moneyMovements = patch.moneyMovements ?? store.moneyMovements ?? [];
  const supplierBills = patch.supplierBills ?? store.supplierBills ?? [];
  const orders = patch.orders ?? store.orders;
  return {
    ...store,
    ...patch,
    moneyMovements,
    supplierBills,
    orders: syncOrderPaidAmounts(orders, moneyMovements),
  };
}

function dedupeOrders(orders: Order[]) {
  const byId = new Map<string, Order>();
  for (const order of orders) {
    const current = byId.get(order.id);
    if (!current || Date.parse(order.updatedAt) >= Date.parse(current.updatedAt)) {
      byId.set(order.id, order);
    }
  }
  const unique = Array.from(byId.values());
  const used = new Set<string>();
  return unique.map((order) => {
    if (!used.has(order.number)) {
      used.add(order.number);
      return order;
    }
    const next = { ...order, number: nextUniqueNumber(unique, used) };
    used.add(next.number);
    return next;
  });
}

function nextUniqueNumber(orders: Order[], used: Set<string>) {
  let n = orders.reduce((acc, order) => {
    const match = /^(?:ЗК|ZK|SP)-(\d+)$/i.exec(order.number);
    return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  let value = `ЗК-${String(n + 1).padStart(4, "0")}`;
  while (used.has(value)) {
    n += 1;
    value = `ЗК-${String(n).padStart(4, "0")}`;
  }
  return value;
}

async function persistStore(store: StoreSnapshot) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function readStoreFile(): Promise<StoreSnapshot> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isStore(parsed)) {
      const migrated = migrateStore(parsed);
      if (
        parsed.version !== migrated.version ||
        !Array.isArray(parsed.clients) ||
        !Array.isArray(parsed.moneyMovements) ||
        !Array.isArray(parsed.supplierBills)
      ) {
        await persistStore(migrated);
      }
      return migrated;
    }
  } catch {
    // first run
  }
  const initial = createInitialStore();
  await persistStore(initial);
  return initial;
}

export function readStore() {
  return enqueue(() => readStoreFile());
}

export function writeStore(store: StoreSnapshot) {
  return enqueue(async () => {
    await persistStore(store);
    return store;
  });
}

export function resetStore() {
  return enqueue(async () => {
    const initial = createInitialStore();
    await persistStore(initial);
    return initial;
  });
}

export function upsertSupplier(supplier: Supplier) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const exists = store.suppliers.some((item) => item.id === supplier.id);
    const next: StoreSnapshot = {
      ...store,
      suppliers: exists
        ? store.suppliers.map((item) => (item.id === supplier.id ? supplier : item))
        : [supplier, ...store.suppliers],
    };
    await persistStore(next);
    return next;
  });
}

export function removeSupplier(id: string) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next = withMoney(store, {
      suppliers: store.suppliers.filter((item) => item.id !== id),
      offers: store.offers.filter((item) => item.supplierId !== id),
      logs: store.logs.filter((item) => item.supplierId !== id),
      supplierBills: (store.supplierBills ?? []).filter((item) => item.supplierId !== id),
      moneyMovements: (store.moneyMovements ?? []).map((item) =>
        item.supplierId === id ? { ...item, supplierId: undefined, supplierBillId: undefined } : item,
      ),
    });
    await removeCatalog(id);
    await persistStore(next);
    return next;
  });
}

export function replaceOffers(
  supplierId: string,
  nextOffers: Offer[],
  log: SyncLog,
  mode: ImportMode = "replace",
) {
  return enqueue(async () => {
    const store = await readStoreFile();
    let offers = store.offers;
    if (log.status === "ok") {
      if (mode === "merge") {
        const incoming = new Map(nextOffers.map((offer) => [offer.id, offer]));
        const others = store.offers.filter((offer) => offer.supplierId !== supplierId);
        const leftover = store.offers.filter(
          (offer) => offer.supplierId === supplierId && !incoming.has(offer.id),
        );
        offers = [...others, ...leftover, ...nextOffers];
      } else {
        offers = [...store.offers.filter((offer) => offer.supplierId !== supplierId), ...nextOffers];
      }
    }
    const next: StoreSnapshot = {
      ...store,
      suppliers: store.suppliers.map((supplier) =>
        supplier.id === supplierId
          ? {
              ...supplier,
              lastSyncAt: log.at,
              lastSyncStatus: log.status,
              lastSyncError: log.error,
              lastSyncCount:
                log.status === "ok"
                  ? mode === "merge"
                    ? offers.filter((offer) => offer.supplierId === supplierId).length
                    : log.imported
                  : supplier.lastSyncCount,
            }
          : supplier,
      ),
      offers,
      logs: [{ ...log, mode }, ...store.logs].slice(0, 80),
    };
    await persistStore(next);
    return next;
  });
}

export function touchSupplierSync(
  supplierId: string,
  log: SyncLog,
  count?: number,
  extra?: Partial<Pick<Supplier, "columnMap">>,
) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next: StoreSnapshot = {
      ...store,
      suppliers: store.suppliers.map((supplier) =>
        supplier.id === supplierId
          ? {
              ...supplier,
              ...extra,
              lastSyncAt: log.at,
              lastSyncStatus: log.status,
              lastSyncError: log.error,
              lastSyncCount: log.status === "ok" ? (count ?? log.imported) : supplier.lastSyncCount,
              catalogCount: log.status === "ok" ? (count ?? log.imported) : supplier.catalogCount,
            }
          : supplier,
      ),
      logs: [{ ...log }, ...store.logs].slice(0, 80),
    };
    await persistStore(next);
    return next;
  });
}

export function patchOffer(offerId: string, patch: OfferPatch) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next: StoreSnapshot = {
      ...store,
      offers: store.offers.map((offer) => {
        if (offer.id !== offerId) return offer;
        const oem = patch.oem?.trim() ? patch.oem.trim() : offer.oem;
        const crosses = patch.crossOems ? mergeCrosses(oem, patch.crossOems) : offer.crossOems;
        return {
          ...offer,
          name: patch.name?.trim() ? patch.name.trim() : offer.name,
          brand: patch.brand === undefined ? offer.brand : patch.brand.trim(),
          oem,
          category: patch.category === undefined ? offer.category : patch.category.trim(),
          displayName:
            patch.displayName === undefined ? offer.displayName : patch.displayName.trim(),
          notes: patch.notes === undefined ? offer.notes : patch.notes,
          applicability: patch.applicability === undefined ? offer.applicability : patch.applicability,
          crossOems: crosses,
          specs: patch.specs ? { ...(offer.specs ?? {}), ...patch.specs } : offer.specs,
          images: patch.images ?? offer.images,
          stock: patch.stock === undefined ? offer.stock : patch.stock,
        };
      }),
    };
    await persistStore(next);
    return next;
  });
}

export function upsertClient(client: Client) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const exists = store.clients.some((item) => item.id === client.id);
    const next: StoreSnapshot = {
      ...store,
      clients: exists
        ? store.clients.map((item) => (item.id === client.id ? client : item))
        : [client, ...store.clients],
    };
    await persistStore(next);
    return next;
  });
}

export function removeClient(id: string) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next = withMoney(store, {
      clients: store.clients.filter((item) => item.id !== id),
      orders: store.orders.map((order) =>
        order.clientId === id ? { ...order, clientId: "" } : order,
      ),
      moneyMovements: (store.moneyMovements ?? []).map((item) =>
        item.clientId === id ? { ...item, clientId: undefined } : item,
      ),
    });
    await persistStore(next);
    return next;
  });
}

export function upsertOrder(order: Order) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const exists = store.orders.some((item) => item.id === order.id);
    const next: StoreSnapshot = {
      ...store,
      orders: exists
        ? store.orders.map((item) => (item.id === order.id ? order : item))
        : [order, ...store.orders],
    };
    await persistStore(next);
    return next;
  });
}

export function removeOrder(id: string) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next = withMoney(store, {
      orders: store.orders.filter((item) => item.id !== id),
      moneyMovements: (store.moneyMovements ?? []).map((item) =>
        item.orderId === id ? { ...item, orderId: undefined } : item,
      ),
    });
    await persistStore(next);
    return next;
  });
}

function sanitizeMovement(raw: MoneyMovement): MoneyMovement | null {
  const amount = roundCash(Number(raw.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!PAYMENT_METHODS.has(raw.method)) return null;
  if (raw.direction !== "income" && raw.direction !== "expense") return null;
  return normalizeMovement({
    ...raw,
    id: raw.id?.trim() || crypto.randomUUID(),
    amount,
  });
}

function sanitizeBill(raw: SupplierBill, existing: SupplierBill[]): SupplierBill | null {
  const amount = roundCash(Number(raw.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!raw.supplierId?.trim()) return null;
  return normalizeBill({
    ...raw,
    id: raw.id?.trim() || crypto.randomUUID(),
    number: raw.number?.trim() || nextBillNumber(existing),
    amount,
    updatedAt: new Date().toISOString(),
  });
}

export function upsertMoneyMovement(movement: MoneyMovement) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const nextMovement = sanitizeMovement(movement);
    if (!nextMovement) throw new Error("Укажите сумму и способ оплаты");
    const exists = store.moneyMovements.some((item) => item.id === nextMovement.id);
    const moneyMovements = exists
      ? store.moneyMovements.map((item) => (item.id === nextMovement.id ? nextMovement : item))
      : [nextMovement, ...store.moneyMovements];
    const next = withMoney(store, { moneyMovements });
    await persistStore(next);
    return next;
  });
}

export function removeMoneyMovement(id: string) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next = withMoney(store, {
      moneyMovements: store.moneyMovements.filter((item) => item.id !== id),
    });
    await persistStore(next);
    return next;
  });
}

export function upsertSupplierBill(bill: SupplierBill) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const nextBill = sanitizeBill(bill, store.supplierBills);
    if (!nextBill) throw new Error("Укажите поставщика и сумму счёта");
    const exists = store.supplierBills.some((item) => item.id === nextBill.id);
    const supplierBills = exists
      ? store.supplierBills.map((item) => (item.id === nextBill.id ? nextBill : item))
      : [nextBill, ...store.supplierBills];
    const next = withMoney(store, { supplierBills });
    await persistStore(next);
    return next;
  });
}

export function removeSupplierBill(id: string) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next = withMoney(store, {
      supplierBills: store.supplierBills.filter((item) => item.id !== id),
      moneyMovements: store.moneyMovements.map((item) =>
        item.supplierBillId === id ? { ...item, supplierBillId: undefined } : item,
      ),
    });
    await persistStore(next);
    return next;
  });
}

async function readSettingsFile(): Promise<AppSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...EMPTY_SETTINGS,
      ...parsed,
      priceBands: parsed.priceBands?.length ? parsed.priceBands : DEFAULT_PRICE_BANDS,
      guestPriceBands: parsed.guestPriceBands?.length
        ? sanitizeBands(parsed.guestPriceBands)
        : defaultGuestBands(),
      managerPriceBands: parsed.managerPriceBands?.length
        ? sanitizeBands(parsed.managerPriceBands)
        : parsed.priceBands?.length
          ? parsed.priceBands
          : DEFAULT_PRICE_BANDS,
      telegramChats: Array.isArray(parsed.telegramChats) ? parsed.telegramChats : [],
    };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

export function readSettings() {
  return enqueue(() => readSettingsFile());
}

export function writeSettings(patch: Partial<AppSettings>) {
  return enqueue(async () => {
    const current = await readSettingsFile();
    const next = { ...current, ...patch };
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
}

export function maskToken(token: string) {
  const value = token.trim();
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
