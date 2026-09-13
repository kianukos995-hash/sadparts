"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadStore, resetStore, saveStore } from "@/lib/storage";
import type { Offer, StoreSnapshot, Supplier, SyncLog } from "@/lib/types";

type Listener = () => void;

const EMPTY_STORE: StoreSnapshot = {
  version: 1,
  suppliers: [],
  offers: [],
  logs: [],
};

let snapshot: StoreSnapshot = EMPTY_STORE;
const listeners = new Set<Listener>();

function emit(next: StoreSnapshot) {
  snapshot = next;
  saveStore(next);
  listeners.forEach((listener) => listener());
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

export function AvtoPriceProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreSnapshot>(EMPTY_STORE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is only available after mount */
    const loaded = loadStore();
    snapshot = loaded;
    setStore(loaded);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const listener = () => setStore(snapshot);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const upsertSupplier = useCallback((supplier: Supplier) => {
    const prev = snapshot.suppliers.length || snapshot.offers.length ? snapshot : loadStore();
    const exists = prev.suppliers.some((item) => item.id === supplier.id);
    emit({
      ...prev,
      suppliers: exists
        ? prev.suppliers.map((item) => (item.id === supplier.id ? supplier : item))
        : [supplier, ...prev.suppliers],
    });
  }, []);

  const removeSupplier = useCallback((id: string) => {
    const prev = snapshot;
    emit({
      ...prev,
      suppliers: prev.suppliers.filter((item) => item.id !== id),
      offers: prev.offers.filter((item) => item.supplierId !== id),
      logs: prev.logs.filter((item) => item.supplierId !== id),
    });
  }, []);

  const replaceOffers = useCallback((supplierId: string, nextOffers: Offer[], log: SyncLog) => {
    const prev = snapshot;
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
