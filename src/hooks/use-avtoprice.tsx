"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { copyClientVehicle, emptyDraft, findDraft, findDraftForClient, findDrafts, offerToLine } from "@/lib/order";
import { DEFAULT_PRICE_BANDS } from "@/lib/price-bands";
import { STORE_VERSION } from "@/lib/constants";
import type { OfferPatch } from "@/lib/offer-patches";
import { clearLocalDrafts, draftStorageKey, ordersStorageKey } from "@/lib/local-drafts";
import { useAuth } from "@/hooks/use-auth";
import type {
  Client,
  ImportMode,
  MoneyMovement,
  Offer,
  Order,
  Organization,
  PublicSettings,
  PurchaseOrder,
  StoreSnapshot,
  Supplier,
  SupplierBill,
  SyncLog,
  WarehouseDoc,
  WarehouseLot,
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
  organizations: [],
  purchases: [],
  warehouseLots: [],
  warehouseDocs: [],
};

const EMPTY_PUBLIC: PublicSettings = {
  telegramConfigured: false,
  telegramUsername: "",
  telegramPolling: true,
  telegramTokenMasked: "",
  markupPercent: 18,
  moscowHubNote: "",
  priceBands: DEFAULT_PRICE_BANDS,
  guestPriceBands: DEFAULT_PRICE_BANDS,
  managerPriceBands: DEFAULT_PRICE_BANDS,
  sellerTitle: "",
  sellerAddress: "",
  vatPercent: 0,
  telegramNotifyChatId: "",
  telegramChats: [],
  organizationPriceBands: [],
  maxMarkup: null,
  showAdminPricing: false,
};

const ORDERS_KEY = "sadparts-orders-v1";

export interface AvtoPriceApi {
  ready: boolean;
  error: string | null;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  clients: Client[];
  organizations: Organization[];
  orders: Order[];
  moneyMovements: MoneyMovement[];
  supplierBills: SupplierBill[];
  purchases: PurchaseOrder[];
  warehouseLots: WarehouseLot[];
  warehouseDocs: WarehouseDoc[];
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
  upsertOrganization: (org: Organization) => Promise<void>;
  removeOrganization: (id: string) => Promise<void>;
  upsertOrder: (order: Order) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  upsertMoneyMovement: (movement: MoneyMovement) => Promise<void>;
  removeMoneyMovement: (id: string) => Promise<void>;
  upsertSupplierBill: (bill: SupplierBill) => Promise<void>;
  removeSupplierBill: (id: string) => Promise<void>;
  upsertPurchase: (purchase: PurchaseOrder) => Promise<void>;
  removePurchase: (id: string) => Promise<void>;
  postPurchase: (id: string) => Promise<void>;
  unpostPurchase: (id: string) => Promise<void>;
  createWarehouseReceipt: (receipt: {
    supplierId?: string;
    party: string;
    lines: { sku: string; brand: string; name?: string; qty: number; warehouse: string }[];
    number?: string;
  }) => Promise<void>;
  addToDraft: (
    offer: Offer,
    qty?: number,
    options?: { newOrder?: boolean; orderId?: string; clientId?: string },
  ) => Promise<Order>;
  saveTradeSettings: (patch: {
    markupPercent?: number;
    moscowHubNote?: string;
    priceBands?: PublicSettings["priceBands"];
    guestPriceBands?: PublicSettings["guestPriceBands"];
    managerPriceBands?: PublicSettings["managerPriceBands"];
    sellerTitle?: string;
    sellerAddress?: string;
    vatPercent?: number;
    telegramNotifyChatId?: string;
  }) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AvtoPriceContext = createContext<AvtoPriceApi | null>(null);

function loadLocalOrders(userId?: string | null): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(ordersStorageKey(userId)) ||
      (userId ? "" : window.localStorage.getItem(ORDERS_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: Order[], userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ordersStorageKey(userId), JSON.stringify(orders));
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
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const locked = user?.role === "client" || user?.role === "guest";
  const clientId = user?.clientId ?? "";
  const [store, setStore] = useState<StoreSnapshot>(EMPTY_STORE);
  const [settings, setSettings] = useState<PublicSettings>(EMPTY_PUBLIC);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftIdState] = useState("");
  const dirty = useRef(false);

  const applyStore = useCallback(
    (data: StoreSnapshot, local = loadLocalOrders(userId)) => {
      const scopedLocal = locked
        ? local.filter(
            (order) =>
              (clientId && order.clientId === clientId) || order.createdByUserId === userId,
          )
        : local;
      const orders = mergeOrders(data.orders ?? [], scopedLocal);
      saveLocalOrders(orders, userId);
      setStore({
        ...data,
        clients: data.clients ?? [],
        orders,
        moneyMovements: data.moneyMovements ?? [],
        supplierBills: data.supplierBills ?? [],
        organizations: data.organizations ?? [],
        purchases: data.purchases ?? [],
        warehouseLots: data.warehouseLots ?? [],
        warehouseDocs: data.warehouseDocs ?? [],
      });
      return orders;
    },
    [userId, locked, clientId],
  );

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
        const saved =
          typeof window !== "undefined" ? window.localStorage.getItem(draftStorageKey(userId)) : "";
        if (saved && orders.some((item) => item.id === saved)) return saved;
        const own = clientId
          ? findDraftForClient(orders, clientId)
          : findDraft(orders);
        return own?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не загрузить данные");
      setReady(true);
    }
  }, [applyStore, userId, clientId]);

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

  const setActiveDraftId = useCallback(
    (id: string) => {
      setActiveDraftIdState(id);
      if (typeof window !== "undefined") window.localStorage.setItem(draftStorageKey(userId), id);
    },
    [userId],
  );

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

  const upsertOrganization = useCallback(async (organization: Organization) => {
    applyStore(await mutate({ action: "upsertOrganization", organization }));
  }, [applyStore]);

  const removeOrganization = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removeOrganization", organizationId: id }));
  }, [applyStore]);

  const upsertOrder = useCallback(async (order: Order) => {
    dirty.current = true;
    const next = { ...order, updatedAt: new Date().toISOString() };
    setStore((current) => {
      const exists = current.orders.some((item) => item.id === next.id);
      const orders = exists
        ? current.orders.map((item) => (item.id === next.id ? next : item))
        : [next, ...current.orders];
      saveLocalOrders(orders, userId);
      return { ...current, orders };
    });
    try {
      applyStore(await mutate({ action: "upsertOrder", order: next }));
      dirty.current = false;
    } catch (error) {
      dirty.current = true;
      throw error;
    }
  }, [applyStore, userId]);

  const removeOrder = useCallback(async (id: string) => {
    setStore((current) => {
      const orders = current.orders.filter((item) => item.id !== id);
      saveLocalOrders(orders, userId);
      return { ...current, orders };
    });
    applyStore(await mutate({ action: "removeOrder", orderId: id }));
  }, [applyStore, userId]);

  const addToDraft = useCallback(
    async (
      offer: Offer,
      qty = 1,
      options?: { newOrder?: boolean; orderId?: string; clientId?: string },
    ) => {
      const targetClientId = (locked ? clientId : "") || options?.clientId;
      const draftExtra = { organizationId: user?.organizationId, createdByUserId: userId };
      const drafts = findDrafts(store.orders);
      let draft: Order;
      if (options?.newOrder) {
        draft = emptyDraft(store.orders, store.clients, settings.markupPercent, targetClientId, draftExtra);
      } else if (options?.orderId) {
        draft =
          store.orders.find((item) => item.id === options.orderId) ??
          drafts.find((item) => item.id === options.orderId) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent, targetClientId, draftExtra);
      } else if (targetClientId) {
        draft =
          findDraftForClient(store.orders, targetClientId) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent, targetClientId, draftExtra);
      } else {
        draft =
          drafts.find((item) => item.id === activeDraftId) ??
          findDraft(store.orders) ??
          emptyDraft(store.orders, store.clients, settings.markupPercent, targetClientId, draftExtra);
      }
      if (targetClientId && draft.clientId !== targetClientId) {
        const client = store.clients.find((item) => item.id === targetClientId);
        draft = { ...draft, clientId: targetClientId, ...copyClientVehicle(client) };
      }
      const line = offerToLine(offer, qty);
      const existing = draft.lines.find((item) => item.offerId === offer.id);
      const lines = existing
        ? draft.lines.map((item) =>
            item.offerId === offer.id ? { ...item, qty: item.qty + line.qty } : item,
          )
        : [...draft.lines, line];
      const next = {
        ...draft,
        lines,
        updatedAt: new Date().toISOString(),
        createdByUserId: draft.createdByUserId || userId,
        organizationId: draft.organizationId || user?.organizationId,
      };
      await upsertOrder(next);
      setActiveDraftId(next.id);
      return next;
    },
    [
      store.orders,
      store.clients,
      settings.markupPercent,
      activeDraftId,
      upsertOrder,
      setActiveDraftId,
      locked,
      clientId,
      user?.organizationId,
      userId,
    ],
  );

  const saveTradeSettings = useCallback(
    async (patch: {
      markupPercent?: number;
      moscowHubNote?: string;
      priceBands?: PublicSettings["priceBands"];
      guestPriceBands?: PublicSettings["guestPriceBands"];
      managerPriceBands?: PublicSettings["managerPriceBands"];
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
    clearLocalDrafts(userId);
    applyStore(await mutate({ action: "reset" }), []);
  }, [applyStore, userId]);

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

  const upsertPurchase = useCallback(async (purchase: PurchaseOrder) => {
    applyStore(await mutate({ action: "upsertPurchase", purchase }));
  }, [applyStore]);

  const removePurchase = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "removePurchase", purchaseId: id }));
  }, [applyStore]);

  const postPurchase = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "postPurchase", purchaseId: id }));
  }, [applyStore]);

  const unpostPurchase = useCallback(async (id: string) => {
    applyStore(await mutate({ action: "unpostPurchase", purchaseId: id }));
  }, [applyStore]);

  const createWarehouseReceipt = useCallback(
    async (receipt: {
      supplierId?: string;
      party: string;
      lines: { sku: string; brand: string; name?: string; qty: number; warehouse: string }[];
      number?: string;
    }) => {
      applyStore(await mutate({ action: "createWarehouseReceipt", receipt }));
    },
    [applyStore],
  );

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
      organizations: store.organizations ?? [],
      orders: store.orders,
      moneyMovements: store.moneyMovements ?? [],
      supplierBills: store.supplierBills ?? [],
      purchases: store.purchases ?? [],
      warehouseLots: store.warehouseLots ?? [],
      warehouseDocs: store.warehouseDocs ?? [],
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
      upsertOrganization,
      removeOrganization,
      upsertOrder,
      removeOrder,
      upsertMoneyMovement,
      removeMoneyMovement,
      upsertSupplierBill,
      removeSupplierBill,
      upsertPurchase,
      removePurchase,
      postPurchase,
      unpostPurchase,
      createWarehouseReceipt,
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
      upsertOrganization,
      removeOrganization,
      upsertOrder,
      removeOrder,
      upsertMoneyMovement,
      removeMoneyMovement,
      upsertSupplierBill,
      removeSupplierBill,
      upsertPurchase,
      removePurchase,
      postPurchase,
      unpostPurchase,
      createWarehouseReceipt,
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
