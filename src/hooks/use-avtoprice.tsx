"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { emptyDraft, findDraft, offerToLine } from "@/lib/order";
import type {
  Client,
  ImportMode,
  Offer,
  Order,
  PublicSettings,
  StoreSnapshot,
  Supplier,
  SyncLog,
} from "@/lib/types";

const EMPTY_STORE: StoreSnapshot = {
  version: 2,
  suppliers: [],
  offers: [],
  logs: [],
  clients: [],
  orders: [],
};

const EMPTY_PUBLIC: PublicSettings = {
  telegramConfigured: false,
  telegramUsername: "",
  telegramPolling: true,
  telegramTokenMasked: "",
  markupPercent: 18,
  moscowHubNote: "",
};

export interface AvtoPriceApi {
  ready: boolean;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  clients: Client[];
  orders: Order[];
  draft: Order | null;
  settings: PublicSettings;
  refresh: () => Promise<void>;
  upsertSupplier: (supplier: Supplier) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  replaceOffers: (
    supplierId: string,
    offers: Offer[],
    log: SyncLog,
    mode?: ImportMode,
  ) => Promise<void>;
  patchOffer: (
    offerId: string,
    patch: Partial<Pick<Offer, "displayName" | "crossOems" | "name">>,
  ) => Promise<void>;
  upsertClient: (client: Client) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  upsertOrder: (order: Order) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  addToDraft: (offer: Offer, qty?: number) => Promise<void>;
  saveTradeSettings: (patch: { markupPercent?: number; moscowHubNote?: string }) => Promise<void>;
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
  const [settings, setSettings] = useState<PublicSettings>(EMPTY_PUBLIC);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [storeResponse, settingsResponse] = await Promise.all([
      fetch("/api/store", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
    ]);
    const data = (await storeResponse.json()) as StoreSnapshot;
    const publicSettings = (await settingsResponse.json()) as PublicSettings;
    setStore({
      ...data,
      clients: data.clients ?? [],
      orders: data.orders ?? [],
    });
    setSettings(publicSettings);
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

  const upsertSupplier = useCallback(async (supplier: Supplier) => {
    setStore(await mutate({ action: "upsertSupplier", supplier }));
  }, []);

  const removeSupplier = useCallback(async (id: string) => {
    setStore(await mutate({ action: "removeSupplier", supplierId: id }));
  }, []);

  const replaceOffers = useCallback(
    async (supplierId: string, offers: Offer[], log: SyncLog, mode: ImportMode = "replace") => {
      setStore(await mutate({ action: "replaceOffers", supplierId, offers, log, mode }));
    },
    [],
  );

  const patchOffer = useCallback(
    async (offerId: string, patch: Partial<Pick<Offer, "displayName" | "crossOems" | "name">>) => {
      setStore(await mutate({ action: "patchOffer", offerId, patch }));
    },
    [],
  );

  const upsertClient = useCallback(async (client: Client) => {
    setStore(await mutate({ action: "upsertClient", client }));
  }, []);

  const removeClient = useCallback(async (id: string) => {
    setStore(await mutate({ action: "removeClient", clientId: id }));
  }, []);

  const upsertOrder = useCallback(async (order: Order) => {
    setStore(await mutate({ action: "upsertOrder", order }));
  }, []);

  const removeOrder = useCallback(async (id: string) => {
    setStore(await mutate({ action: "removeOrder", orderId: id }));
  }, []);

  const addToDraft = useCallback(
    async (offer: Offer, qty = 1) => {
      const draft =
        findDraft(store.orders) ??
        emptyDraft(store.orders, store.clients, settings.markupPercent);
      const existing = draft.lines.find((line) => line.offerId === offer.id);
      const line = offerToLine(offer, qty);
      const lines = existing
        ? draft.lines.map((item) =>
            item.offerId === offer.id ? { ...item, qty: item.qty + line.qty } : item,
          )
        : [...draft.lines, line];
      setStore(
        await mutate({
          action: "upsertOrder",
          order: { ...draft, lines, updatedAt: new Date().toISOString() },
        }),
      );
    },
    [store.orders, store.clients, settings.markupPercent],
  );

  const saveTradeSettings = useCallback(
    async (patch: { markupPercent?: number; moscowHubNote?: string }) => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as PublicSettings & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не сохранить настройки");
      setSettings(data);
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
      clients: store.clients,
      orders: store.orders,
      draft: findDraft(store.orders),
      settings,
      refresh,
      upsertSupplier,
      removeSupplier,
      replaceOffers,
      patchOffer,
      upsertClient,
      removeClient,
      upsertOrder,
      removeOrder,
      addToDraft,
      saveTradeSettings,
      resetDemo,
    }),
    [
      ready,
      store,
      settings,
      refresh,
      upsertSupplier,
      removeSupplier,
      replaceOffers,
      patchOffer,
      upsertClient,
      removeClient,
      upsertOrder,
      removeOrder,
      addToDraft,
      saveTradeSettings,
      resetDemo,
    ],
  );

  return <AvtoPriceContext.Provider value={value}>{children}</AvtoPriceContext.Provider>;
}

export function useAvtoPrice() {
  const ctx = useContext(AvtoPriceContext);
  if (!ctx) throw new Error("useAvtoPrice must be used within AvtoPriceProvider");
  return ctx;
}
