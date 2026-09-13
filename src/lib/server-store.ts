import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { STORE_VERSION } from "@/lib/constants";
import { mergeCrosses } from "@/lib/cross-catalog";
import { createInitialStore, DEFAULT_CLIENTS } from "@/lib/seed";
import type {
  AppSettings,
  Client,
  ImportMode,
  Offer,
  Order,
  StoreSnapshot,
  Supplier,
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
    return {
      ...supplier,
      deliveryDaysMoscow: supplier.deliveryDaysMoscow ?? fallback?.days ?? 2,
      deliveryNote: supplier.deliveryNote ?? fallback?.note ?? "",
      columnMap: { ...DEFAULT_COLUMN_MAP, ...supplier.columnMap },
    };
  });
  const supplierDays = new Map(suppliers.map((item) => [item.id, item.deliveryDaysMoscow]));
  const offers = store.offers.map((offer) => ({
    ...offer,
    displayName: offer.displayName ?? "",
    crossOems: mergeCrosses(offer.oem, offer.crossOems ?? []),
    deliveryDays: offer.deliveryDays || supplierDays.get(offer.supplierId) || 2,
  }));
  return {
    ...store,
    version: STORE_VERSION,
    suppliers,
    offers,
    clients: Array.isArray(store.clients) ? store.clients : DEFAULT_CLIENTS,
    orders: Array.isArray(store.orders) ? store.orders : [],
  };
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
      if (parsed.version !== migrated.version || !Array.isArray(parsed.clients)) {
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
    const next: StoreSnapshot = {
      ...store,
      suppliers: store.suppliers.filter((item) => item.id !== id),
      offers: store.offers.filter((item) => item.supplierId !== id),
      logs: store.logs.filter((item) => item.supplierId !== id),
    };
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

export function patchOffer(offerId: string, patch: Partial<Pick<Offer, "displayName" | "crossOems" | "name">>) {
  return enqueue(async () => {
    const store = await readStoreFile();
    const next: StoreSnapshot = {
      ...store,
      offers: store.offers.map((offer) => {
        if (offer.id !== offerId) return offer;
        const oem = offer.oem;
        const crosses = patch.crossOems ? mergeCrosses(oem, patch.crossOems) : offer.crossOems;
        return {
          ...offer,
          name: patch.name?.trim() ? patch.name.trim() : offer.name,
          displayName:
            patch.displayName === undefined ? offer.displayName : patch.displayName.trim(),
          crossOems: crosses,
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
    const next: StoreSnapshot = {
      ...store,
      clients: store.clients.filter((item) => item.id !== id),
      orders: store.orders.map((order) =>
        order.clientId === id ? { ...order, clientId: "" } : order,
      ),
    };
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
    const next: StoreSnapshot = {
      ...store,
      orders: store.orders.filter((item) => item.id !== id),
    };
    await persistStore(next);
    return next;
  });
}

async function readSettingsFile(): Promise<AppSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...EMPTY_SETTINGS, ...parsed };
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
