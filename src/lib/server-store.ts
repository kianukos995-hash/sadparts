import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInitialStore } from "@/lib/seed";
import type { AppSettings, ImportMode, Offer, StoreSnapshot, Supplier, SyncLog } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const EMPTY_SETTINGS: AppSettings = {
  telegramToken: "",
  telegramUsername: "",
  telegramPolling: true,
  telegramOffset: 0,
  telegramSecret: "",
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

async function readStoreFile(): Promise<StoreSnapshot> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isStore(parsed)) return parsed;
  } catch {
    // first run
  }
  const initial = createInitialStore();
  await persistStore(initial);
  return initial;
}

async function persistStore(store: StoreSnapshot) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
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
