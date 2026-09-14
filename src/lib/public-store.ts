import type { AccessKeyRecord, Offer, Order, PublicUser, StoreSnapshot, Supplier } from "@/lib/types";
import { canSeeCost, canSeeMoney, canSeeOwnCost, canSeeSuppliers, clientNavOnly, scopedClients, scopedOrders } from "@/lib/scope";
import { costBasis, publicOffer, publicSupplier, viewerPriceContext, type ViewerPriceContext } from "@/lib/viewer-price";
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
    publicOrder(user, order, ctx),
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
  return {
    ...store,
    suppliers,
    offers,
    clients,
    orders,
    organizations,
    moneyMovements: canSeeMoney(user.role) ? store.moneyMovements : [],
    supplierBills: canSeeMoney(user.role) ? store.supplierBills : [],
    logs: user.role === "admin" || user.role === "organization" ? store.logs : [],
  };
}

function stripSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    apiUrl: "",
    notes: supplier.deliveryNote,
  };
}

function publicOrder(user: PublicUser, order: Order, ctx: ViewerPriceContext): Order {
  if (canSeeCost(user.role)) return order;
  if (clientNavOnly(user.role)) {
    return {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        buyPrice: line.snapshotSell ?? line.buyPrice,
      })),
    };
  }
  if (canSeeOwnCost(user.role)) {
    return {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        buyPrice: costBasis(line.buyPrice, ctx),
      })),
    };
  }
  return order;
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
