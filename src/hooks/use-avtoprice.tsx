"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { loadStore, resetStore, saveStore } from "@/lib/storage";
import type { Offer, StoreSnapshot, Supplier, SyncLog } from "@/lib/types";

type Listener = () => void;

let snapshot: StoreSnapshot | null = null;
const listeners = new Set<Listener>();

function current(): StoreSnapshot {
  if (!snapshot) snapshot = loadStore();
  return snapshot;
}

function emit(next: StoreSnapshot) {
  snapshot = next;
  saveStore(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current();
}

function getServerSnapshot(): StoreSnapshot {
  return {
    version: 1,
    suppliers: [],
    offers: [],
    logs: [],
  };
}

export interface AvtoPriceApi {
  ready: boolean;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  upsertSupplier: (supplier: Supplier) => void;
  removeSupplier: (id: string) => void;
  replaceOffers: (supplierId: string, offers: Offer[], log: SyncLog) => void;
  resetDemo: () => void;
}

const AvtoPriceContext = createContext<AvtoPriceApi | null>(null);

function subscribeHydration() {
  return () => {};
}

export function AvtoPriceProvider({ children }: { children: React.ReactNode }) {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeHydration, () => true, () => false);

  const upsertSupplier = useCallback((supplier: Supplier) => {
    const prev = current();
    const exists = prev.suppliers.some((item) => item.id === supplier.id);
    emit({
      ...prev,
      suppliers: exists
        ? prev.suppliers.map((item) => (item.id === supplier.id ? supplier : item))
        : [supplier, ...prev.suppliers],
    });
  }, []);

  const removeSupplier = useCallback((id: string) => {
    const prev = current();
    emit({
      ...prev,
      suppliers: prev.suppliers.filter((item) => item.id !== id),
      offers: prev.offers.filter((item) => item.supplierId !== id),
      logs: prev.logs.filter((item) => item.supplierId !== id),
    });
  }, []);

  const replaceOffers = useCallback((supplierId: string, nextOffers: Offer[], log: SyncLog) => {
    const prev = current();
    emit({
      ...prev,
      suppliers: prev.suppliers.map((supplier) =>
        supplier.id === supplierId
          ? {
              ...supplier,
              lastSyncAt: log.at,
              lastSyncStatus: log.status,
              lastSyncError: log.error,
              lastSyncCount: log.status === "ok" ? log.imported : supplier.lastSyncCount,
            }
          : supplier,
      ),
      offers:
        log.status === "ok"
          ? [...prev.offers.filter((offer) => offer.supplierId !== supplierId), ...nextOffers]
          : prev.offers,
      logs: [log, ...prev.logs].slice(0, 50),
    });
  }, []);

  const resetDemo = useCallback(() => {
    emit(resetStore());
  }, []);

  const value = useMemo<AvtoPriceApi>(
    () => ({
      ready,
      suppliers: store.suppliers,
      offers: store.offers,
      logs: store.logs,
      upsertSupplier,
      removeSupplier,
      replaceOffers,
      resetDemo,
    }),
    [ready, store, upsertSupplier, removeSupplier, replaceOffers, resetDemo],
  );

  return <AvtoPriceContext.Provider value={value}>{children}</AvtoPriceContext.Provider>;
}

export function useAvtoPrice() {
  const ctx = useContext(AvtoPriceContext);
  if (!ctx) throw new Error("useAvtoPrice must be used within AvtoPriceProvider");
  return ctx;
}
