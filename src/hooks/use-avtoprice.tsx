"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ImportMode, Offer, StoreSnapshot, Supplier, SyncLog } from "@/lib/types";

const EMPTY_STORE: StoreSnapshot = {
  version: 1,
  suppliers: [],
  offers: [],
  logs: [],
};

export interface AvtoPriceApi {
  ready: boolean;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  refresh: () => Promise<void>;
  upsertSupplier: (supplier: Supplier) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  replaceOffers: (
    supplierId: string,
    offers: Offer[],
    log: SyncLog,
    mode?: ImportMode,
  ) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AvtoPriceContext = createContext<AvtoPriceApi | null>(null);

async function mutate(body: unknown) {
  const response = await fetch("/api/store/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as StoreSnapshot & { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось сохранить");
  return data;
}

export function AvtoPriceProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreSnapshot>(EMPTY_STORE);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/store", { cache: "no-store" });
    const data = (await response.json()) as StoreSnapshot;
    setStore(data);
    setReady(true);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- catalog is loaded from the server after mount */
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  const upsertSupplier = useCallback(
    async (supplier: Supplier) => {
      setStore(await mutate({ action: "upsertSupplier", supplier }));
    },
    [],
  );

  const removeSupplier = useCallback(async (id: string) => {
    setStore(await mutate({ action: "removeSupplier", supplierId: id }));
  }, []);

  const replaceOffers = useCallback(
    async (supplierId: string, offers: Offer[], log: SyncLog, mode: ImportMode = "replace") => {
      setStore(await mutate({ action: "replaceOffers", supplierId, offers, log, mode }));
    },
    [],
  );

  const resetDemo = useCallback(async () => {
    setStore(await mutate({ action: "reset" }));
  }, []);

  const value = useMemo<AvtoPriceApi>(
    () => ({
      ready,
      suppliers: store.suppliers,
      offers: store.offers,
      logs: store.logs,
      refresh,
      upsertSupplier,
      removeSupplier,
      replaceOffers,
      resetDemo,
    }),
    [ready, store, refresh, upsertSupplier, removeSupplier, replaceOffers, resetDemo],
  );

  return <AvtoPriceContext.Provider value={value}>{children}</AvtoPriceContext.Provider>;
}

export function useAvtoPrice() {
  const ctx = useContext(AvtoPriceContext);
  if (!ctx) throw new Error("useAvtoPrice must be used within AvtoPriceProvider");
  return ctx;
}
