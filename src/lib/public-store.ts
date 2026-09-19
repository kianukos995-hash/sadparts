import type { AccessKeyRecord, Offer, Order, PublicUser, StoreSnapshot, Supplier, SupplierRequest } from "@/lib/types";
import {
  canSeeCost,
  canSeeMoney,
  canSeeSuppliers,
  canSeeTeam,
  canSeeWarehouse,
  scopedByOrganization,
  scopedClients,
  scopedMoney,
  scopedOrders,
} from "@/lib/scope";
import { anonymizeSupplier, hideSuppliersFor } from "@/lib/client-catalog";
import { publicOffer, publicSupplier, viewerPriceContext } from "@/lib/viewer-price";
import type { AppSettings } from "@/lib/types";
import {
  canSeeSupplierCatalog,
  catalogSupplierIds,
  filterOffersForActor,
  sanitizeSupplierForActor,
  visibleSuppliers,
} from "@/lib/suppliers-scope";

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
  const orgs = store.organizations ?? [];
  const catalogIds = catalogSupplierIds(store.suppliers, user);
  const hideNames = hideSuppliersFor(user.role);
  const suppliers = canSeeSuppliers(user.role)
    ? visibleSuppliers(store.suppliers, user).map((item) =>
        sanitizeSupplierForActor(item, user, orgs),
      )
    : store.suppliers
        .filter((item) => catalogIds.has(item.id))
        .map((item) => anonymizeSupplier(publicSupplier(stripSupplier(item), true)));
  const offers = hideNames
    ? []
    : filterOffersForActor(store.offers ?? [], store.suppliers, user).map((offer) =>
        publicOffer(offer, ctx),
      );
  const supplierRequests = publicSupplierRequests(user, store.supplierRequests ?? []);
  const organizations =
    user.role === "admin"
      ? orgs
      : orgs.filter((item) => item.id === user.organizationId);
  const money = canSeeMoney(user.role) ? scopedMoney(user, store.moneyMovements ?? []) : [];
  const warehouseOk = canSeeWarehouse(user.role);
  const purchases = warehouseOk
    ? user.role === "admin"
      ? (store.purchases ?? []).filter((item) => !item.organizationId)
      : scopedByOrganization(user, store.purchases ?? [])
    : [];
  const warehouseLots = warehouseOk ? scopedByOrganization(user, store.warehouseLots ?? []) : [];
  const warehouseDocs = warehouseOk ? scopedByOrganization(user, store.warehouseDocs ?? []) : [];
  const teamOk = canSeeTeam(user.role);
  const memberships = teamOk
    ? (store.managerMemberships ?? []).filter((item) => {
        if (item.organizationId !== user.organizationId) return false;
        if (user.role === "manager") return item.userId === user.id;
        return true;
      })
    : [];
  const scheduleDays = teamOk
    ? (store.scheduleDays ?? []).filter((item) => {
        if (item.organizationId !== user.organizationId) return false;
        if (user.role === "manager") return item.userId === user.id;
        return true;
      })
    : [];
  const scheduleArchives = teamOk
    ? (store.scheduleArchives ?? []).filter((item) => item.organizationId === user.organizationId)
    : [];
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
    managerMemberships: memberships,
    scheduleDays,
    scheduleArchives,
    supplierRequests,
  };
}

function stripSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    apiUrl: "",
    notes: supplier.deliveryNote,
    apiKey: "",
    apiKey2: "",
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
  const priced = offers.map((offer) => publicOffer(offer, ctx));
  if (!hideSuppliersFor(user.role)) return priced;
  return priced;
}

function publicSupplierRequests(user: PublicUser, requests: SupplierRequest[]): SupplierRequest[] {
  if (!canSeeSupplierCatalog(user)) return [];
  const scoped =
    user.role === "admin"
      ? requests
      : requests.filter(
          (item) =>
            item.requestedByUserId === user.id ||
            (user.organizationId && item.organizationId === user.organizationId),
        );
  return scoped.map((item) => ({
    ...item,
    filePath: undefined,
  }));
}
