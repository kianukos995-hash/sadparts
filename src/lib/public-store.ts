import type { AccessKeyRecord, Offer, Order, PublicUser, StoreSnapshot, Supplier } from "@/lib/types";
import {
  canSeeCost,
  canSeeMoney,
  canSeeSuppliers,
  canSeeWarehouse,
  scopedByOrganization,
  scopedClients,
  scopedMoney,
  scopedOrders,
} from "@/lib/scope";
import { publicOffer, publicSupplier, viewerPriceContext } from "@/lib/viewer-price";
import type { AppSettings } from "@/lib/types";

export function publicStoreFor(
  user: PublicUser,
  store: StoreSnapshot,
  settings: AppSettings,
  keys: AccessKeyRecord[] = [],
): StoreSnapshot {
  const ctx = viewerPriceContext(user, store, settings);
  const clients = scopedClients(user, store.clients, keys);
  const orders = scopedOrders(user, store.orders, store.clients, keys).map((order) =>
    publicOrder(user, order),
  );
  const hideSecrets = user.role !== "admin";
  const suppliers = canSeeSuppliers(user.role)
    ? store.suppliers.map((item) => publicSupplier(item, hideSecrets))
    : store.suppliers.map((item) => publicSupplier(stripSupplier(item), true));
  const offers = (store.offers ?? []).map((offer) => publicOffer(offer, ctx));
  const organizations =
    user.role === "admin"
      ? store.organizations ?? []
      : (store.organizations ?? []).filter((item) => item.id === user.organizationId);
  const money = canSeeMoney(user.role) ? scopedMoney(user, store.moneyMovements ?? []) : [];
  const warehouseOk = canSeeWarehouse(user.role);
  const purchases = warehouseOk
    ? user.role === "admin"
      ? (store.purchases ?? []).filter((item) => !item.organizationId)
      : scopedByOrganization(user, store.purchases ?? [])
    : [];
  const warehouseLots = warehouseOk ? scopedByOrganization(user, store.warehouseLots ?? []) : [];
  const warehouseDocs = warehouseOk ? scopedByOrganization(user, store.warehouseDocs ?? []) : [];
  return {
    ...store,
    suppliers,
    offers,
    clients,
    orders,
    organizations,
    moneyMovements: money,
    supplierBills: user.role === "admin" ? store.supplierBills ?? [] : [],
    logs: user.role === "admin" || user.role === "organization" ? store.logs : [],
    purchases,
    warehouseLots,
    warehouseDocs,
  };
}

function stripSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    apiUrl: "",
    notes: supplier.deliveryNote,
  };
}

function publicOrder(user: PublicUser, order: Order): Order {
  if (canSeeCost(user.role, user.seeCost)) return order;
  return {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      buyPrice: line.snapshotSell ?? line.buyPrice,
    })),
  };
}

export function publicOffersFor(
  user: PublicUser,
  offers: Offer[],
  store: StoreSnapshot,
  settings: AppSettings,
) {
  const ctx = viewerPriceContext(user, store, settings);
  return offers.map((offer) => publicOffer(offer, ctx));
}
