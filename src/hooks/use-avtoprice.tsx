"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { copyClientVehicle, emptyDraft, findDraft, findDraftForClient, findDrafts, offerToLine } from "@/lib/order";
import { DEFAULT_PRICE_BANDS } from "@/lib/price-bands";
import { STORE_VERSION } from "@/lib/constants";
import type { OfferPatch } from "@/lib/offer-patches";
import type {
  Client,
  ImportMode,
  MoneyMovement,
  Offer,
  Order,
  PublicSettings,
  StoreSnapshot,
  Supplier,
  SupplierBill,
  SyncLog,
} from "@/lib/types";

const EMPTY_STORE: StoreSnapshot = {
  version: STORE_VERSION,
  suppliers: [],
  offers: [],
  logs: [],
  clients: [],
  orders: [],
  moneyMovements: [],
  supplierBills: [],
};

const EMPTY_PUBLIC: PublicSettings = {
  telegramConfigured: false,
  telegramUsername: "",
  telegramPolling: true,
  telegramTokenMasked: "",
  markupPercent: 18,
  moscowHubNote: "",
  priceBands: DEFAULT_PRICE_BANDS,
  sellerTitle: "",
  sellerAddress: "",
  vatPercent: 0,
  telegramNotifyChatId: "",
  telegramChats: [],
};

const ORDERS_KEY = "sadparts-orders-v1";
const DRAFT_KEY = "sadparts-active-draft";

export interface AvtoPriceApi {
  ready: boolean;
  error: string | null;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  clients: Client[];
  orders: Order[];
  moneyMovements: MoneyMovement[];
  supplierBills: SupplierBill[];
  drafts: Order[];
  draft: Order | null;
  activeDraftId: string;
  setActiveDraftId: (id: string) => void;
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
  patchOffer: (offerId: string, patch: OfferPatch, supplierId?: string) => Promise<void>;
  upsertClient: (client: Client) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  upsertOrder: (order: Order) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  upsertMoneyMovement: (movement: MoneyMovement) => Promise<void>;
  removeMoneyMovement: (id: string) => Promise<void>;
  upsertSupplierBill: (bill: SupplierBill) => Promise<void>;
  removeSupplierBill: (id: string) => Promise<void>;
  addToDraft: (
    offer: Offer,
    qty?: number,
    options?: { newOrder?: boolean; orderId?: string; clientId?: string },
  ) => Promise<Order>;
  saveTradeSettings: (patch: {
    markupPercent?: number;
    moscowHubNote?: string;
    priceBands?: PublicSettings["priceBands"];
    sellerTitle?: string;
    sellerAddress?: string;
    vatPercent?: number;
    telegramNotifyChatId?: string;
  }) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AvtoPriceContext = createContext<AvtoPriceApi | null>(null);

function loadLocalOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function mergeOrders(server: Order[], local: Order[]) {
  const map = new Map<string, Order>();
  for (const order of server) map.set(order.id, order);
  for (const order of local) {
    const current = map.get(order.id);
    if (!current || Date.parse(order.updatedAt) >= Date.parse(current.updatedAt)) {
      map.set(order.id, order);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

async function postStock(direction: "take" | "release", order: Order) {
  if (order.lines.length === 0) return;
  const response = await fetch("/api/catalog/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direction,
      items: order.lines.map((line) => ({
        offerId: line.offerId,
        supplierId: line.supplierId,
        qty: line.qty,
      })),
    }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Не обновить остаток");
  }
}

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
  const [error, setError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftIdState] = useState("");
  const dirty = useRef(false);

  const applyStore = useCallback((data: StoreSnapshot, local = loadLocalOrders()) => {
    const orders = mergeOrders(data.orders ?? [], local);
    saveLocalOrders(orders);
    setStore({
      ...data,
      clients: data.clients ?? [],
      orders,
      moneyMovements: data.moneyMovements ?? [],
      supplierBills: data.supplierBills ?? [],
    });
    return orders;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [storeResponse, settingsResponse] = await Promise.all([
        fetch("/api/store", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      if (!storeResponse.ok) throw new Error("Не загрузить склад");
      const data = (await storeResponse.json()) as StoreSnapshot;
      const publicSettings = (await settingsResponse.json()) as PublicSettings;
      const orders = applyStore(data);
      setSettings(publicSettings);
      setError(null);
      setReady(true);
      setActiveDraftIdState((current) => {
        if (current && orders.some((item) => item.id === current)) return current;
        const saved = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : "";
        if (saved && orders.some((item) => item.id === saved)) return saved;
        return findDraft(orders)?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не загрузить данные");
      setReady(true);
    }
  }, [applyStore]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- store is loaded from the server after mount */
    void refresh();
    const timer = window.setInterval(() => {
      if (!dirty.current) void refresh();
    }, 60_000);
    const persist = () => {
      dirty.current = false;
    };
    window.addEventListener("online", persist);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", persist);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  const setActiveDraftId = useCallback((id: string) => {
    setActiveDraftIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(DRAFT_KEY, id);
  }, []);

  const upsertSupplier = useCallback(async (supplier: Supplier) => {
    applyStore(await mutate({ action: "upsertSupplier", supplier }));
  }, [applyStore]);

  const removeSupplier = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removeSupplier", supplierId: id }));
  }, [applyStore]);

  const replaceOffers = useCallback(
    async (supplierId: string, offers: Offer[], log: SyncLog, mode: ImportMode = "replace") => {
      applyStore(await mutate({ action: "replaceOffers", supplierId, offers, log, mode }));
    },
    [applyStore],
  );

  const patchOffer = useCallback(
    async (
      offerId: string,
      patch: OfferPatch,
      supplierId?: string,
    ) => {
      const response = await fetch("/api/catalog/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, supplierId, patch }),
      });
      const data = (await response.json()) as { store?: StoreSnapshot; error?: string };
      if (!response.ok) throw new Error(data.error || "Не сохранить позицию");
      if (data.store) applyStore(data.store);
    },
    [applyStore],
  );

  const upsertClient = useCallback(async (client: Client) => {
    applyStore(await mutate({ action: "upsertClient", client }));
  }, [applyStore]);

  const removeClient = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removeClient", clientId: id }));
  }, [applyStore]);

  const upsertOrder = useCallback(async (order: Order) => {
    const prev = store.orders.find((item) => item.id === order.id);
    dirty.current = true;
    const next = { ...order, updatedAt: new Date().toISOString() };
    setStore((current) => {
      const exists = current.orders.some((item) => item.id === next.id);
      const orders = exists
        ? current.orders.map((item) => (item.id === next.id ? next : item))
        : [next, ...current.orders];
      saveLocalOrders(orders);
      return { ...current, orders };
    });
    try {
      if (prev?.status === "draft" && next.status === "assembled") {
        await postStock("take", next);
      } else if (prev && prev.status !== "draft" && next.status === "draft") {
        await postStock("release", prev);
      }
      applyStore(await mutate({ action: "upsertOrder", order: next }));
      dirty.current = false;
    } catch (error) {
      dirty.current = true;
      throw error;
    }
  }, [applyStore, store.orders]);

  const removeOrder = useCallback(async (id: string) => {
    const prev = store.orders.find((item) => item.id === id);
    if (prev && prev.status !== "draft") {
      await postStock("release", prev);
    }
    setStore((current) => {
      const orders = current.orders.filter((item) => item.id !== id);
      saveLocalOrders(orders);
      return { ...current, orders };
    });
    applyStore(await mutate({ action: "removeOrder", orderId: id }));
  }, [applyStore, store.orders]);

  const addToDraft = useCallback(
    async (
      offer: Offer,
      qty = 1,
      options?: { newOrder?: boolean; orderId?: string; clientId?: string },
    ) => {
      const drafts = findDrafts(store.orders);
      let draft: Order;
      if (options?.newOrder) {
        draft = emptyDraft(store.orders, store.clients, settings.markupPercent, options.clientId);
      } else if (options?.orderId) {
        draft =
          store.orders.find((item) => item.id === options.orderId) ??
          drafts.find((item) => item.id === options.orderId) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent, options.clientId);
      } else if (options?.clientId) {
        draft =
          findDraftForClient(store.orders, options.clientId) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent, options.clientId);
      } else {
        draft =
          drafts.find((item) => item.id === activeDraftId) ??
          findDraft(store.orders) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent);
      }
      if (options?.clientId && draft.clientId !== options.clientId) {
        const client = store.clients.find((item) => item.id === options.clientId);
        draft = { ...draft, clientId: options.clientId, ...copyClientVehicle(client) };
      }
      const line = offerToLine(offer, qty);
      const existing = draft.lines.find((item) => item.offerId === offer.id);
      const lines = existing
        ? draft.lines.map((item) =>
            item.offerId === offer.id ? { ...item, qty: item.qty + line.qty } : item,
          )
        : [...draft.lines, line];
      const next = { ...draft, lines, updatedAt: new Date().toISOString() };
      await upsertOrder(next);
      setActiveDraftId(next.id);
      return next;
    },
    [store.orders, store.clients, settings.markupPercent, activeDraftId, upsertOrder, setActiveDraftId],
  );

  const saveTradeSettings = useCallback(
    async (patch: {
      markupPercent?: number;
      moscowHubNote?: string;
      priceBands?: PublicSettings["priceBands"];
      sellerTitle?: string;
      sellerAddress?: string;
      vatPercent?: number;
      telegramNotifyChatId?: string;
    }) => {
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
    window.localStorage.removeItem(ORDERS_KEY);
    applyStore(await mutate({ action: "reset" }), []);
  }, [applyStore]);

  const upsertMoneyMovement = useCallback(async (movement: MoneyMovement) => {
    applyStore(await mutate({ action: "upsertMoneyMovement", movement }));
  }, [applyStore]);

  const removeMoneyMovement = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removeMoneyMovement", movementId: id }));
  }, [applyStore]);

  const upsertSupplierBill = useCallback(async (bill: SupplierBill) => {
    applyStore(await mutate({ action: "upsertSupplierBill", bill }));
  }, [applyStore]);

  const removeSupplierBill = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removeSupplierBill", billId: id }));
  }, [applyStore]);

  const drafts = useMemo(() => findDrafts(store.orders), [store.orders]);
  const draft = drafts.find((item) => item.id === activeDraftId) ?? findDraft(store.orders);

  const value = useMemo<AvtoPriceApi>(
    () => ({
      ready,
      error,
      suppliers: store.suppliers,
      offers: store.offers,
      logs: store.logs,
      clients: store.clients,
      orders: store.orders,
      moneyMovements: store.moneyMovements ?? [],
      supplierBills: store.supplierBills ?? [],
      drafts,
      draft,
      activeDraftId: draft?.id ?? "",
      setActiveDraftId,
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
      upsertMoneyMovement,
      removeMoneyMovement,
      upsertSupplierBill,
      removeSupplierBill,
      addToDraft,
      saveTradeSettings,
      resetDemo,
    }),
    [
      ready,
      error,
      store,
      drafts,
      draft,
      settings,
      setActiveDraftId,
      refresh,
      upsertSupplier,
      removeSupplier,
      replaceOffers,
      patchOffer,
      upsertClient,
      removeClient,
      upsertOrder,
      removeOrder,
      upsertMoneyMovement,
      removeMoneyMovement,
      upsertSupplierBill,
      removeSupplierBill,
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
