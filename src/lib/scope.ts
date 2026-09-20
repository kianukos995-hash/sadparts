import type { AccessKeyRecord, Client, Organization, PublicUser, UserRole } from "@/lib/types";
import { EXAMPLE_ORG_ID } from "@/lib/constants";

export const DESK_ROLES: UserRole[] = ["admin", "organization", "manager"];
export const STAFF_ROLES: UserRole[] = ["admin", "organization", "manager"];
export const MONEY_ROLES: UserRole[] = ["admin", "organization", "manager"];
export const SUPPLIER_ROLES: UserRole[] = ["admin", "organization"];
export const SETTINGS_ROLES: UserRole[] = ["admin", "organization", "manager", "client", "guest"];
export const CLIENT_LIST_ROLES: UserRole[] = ["admin", "organization", "manager", "client"];
export const WAREHOUSE_ROLES: UserRole[] = ["admin", "organization", "manager"];
export const INVOICE_ROLES: UserRole[] = ["admin", "organization", "manager"];

export function isDeskRole(role?: UserRole) {
  return role === "admin" || role === "organization" || role === "manager";
}

export function isAdmin(role?: UserRole) {
  return role === "admin";
}

export function clientNavOnly(role?: UserRole) {
  return role === "client" || role === "guest";
}

export function canSeeCost(role?: UserRole, seeCost?: boolean) {
  return role === "admin" || Boolean(seeCost);
}

export function canSeeOwnCost(role?: UserRole, seeCost?: boolean) {
  return canSeeCost(role, seeCost);
}

export function canSeeAnyCost(role?: UserRole, seeCost?: boolean) {
  return canSeeCost(role, seeCost);
}

export function canManageStaff(role?: UserRole) {
  return role === "admin";
}

export function canSeeDesk(role?: UserRole) {
  return isDeskRole(role);
}

export function canSeeMoney(role?: UserRole) {
  return role === "admin" || role === "organization" || role === "manager";
}

export function canSeeWarehouse(role?: UserRole) {
  return isDeskRole(role);
}

export function canSeeInvoices(role?: UserRole) {
  return isDeskRole(role);
}

export function canSeeSuppliers(role?: UserRole) {
  return role === "admin" || role === "organization" || role === "manager";
}

export function canSeeTeam(role?: UserRole) {
  return role === "organization" || role === "manager";
}

export function canSeeSettings(role?: UserRole) {
  return Boolean(role);
}

export function canSeeHistory(role?: UserRole) {
  return isDeskRole(role);
}

export function canSeeOrganizations(role?: UserRole) {
  return role === "admin";
}

export function canSeeClientsPage(role?: UserRole) {
  return role === "admin" || role === "organization" || role === "manager" || role === "client";
}

export function canIssueKeys(role?: UserRole) {
  return role === "admin" || role === "organization" || role === "manager";
}

export function canEditAccessKey(
  actor: PublicUser,
  rec: { issuedByUserId?: string; organizationId?: string },
) {
  if (actor.role === "admin") return true;
  if (actor.role === "organization") {
    return (
      rec.issuedByUserId === actor.id ||
      Boolean(actor.organizationId && rec.organizationId === actor.organizationId)
    );
  }
  if (actor.role === "manager") {
    return rec.issuedByUserId === actor.id;
  }
  return false;
}

/** Админ — все ключи; организация — свои; менеджер — только выданные им. */
export function visibleAccessKeys<T extends { issuedByUserId?: string; organizationId?: string }>(
  actor: PublicUser | undefined,
  keys: T[],
): T[] {
  if (!actor || actor.role === "admin") return keys;
  return keys.filter((rec) => canEditAccessKey(actor, rec));
}

export function homeHref(role?: UserRole) {
  void role;
  return "/";
}

export function orgAsClient(org: Organization): Client {
  return {
    id: org.id,
    name: org.name,
    phone: org.phone,
    inn: org.inn,
    email: org.email,
    discountPercent: org.discountPercent,
    markupPercent: org.markupPercent,
    bandMarkups: org.bandMarkups,
    notes: org.notes,
    createdAt: org.createdAt,
    accessKey: org.accessKey,
    accountStatus: org.accountStatus,
    priceView: org.priceView,
    ownerUserId: org.createdByUserId,
    maxMarkup: org.maxMarkup,
    carMake: undefined,
    carModel: undefined,
  };
}

export function clientVisibleTo(actor: PublicUser, client: Client, keys: AccessKeyRecord[] = []) {
  if (actor.role === "admin") return true;
  if (client.id === "cli-guest" && actor.role !== "guest") return false;
  if (actor.role === "guest") return client.id === actor.clientId;
  if (actor.role === "client") {
    return (
      client.id === actor.clientId ||
      client.ownerUserId === actor.id ||
      client.issuedByUserId === actor.id
    );
  }
  if (actor.role === "organization") {
    return (
      client.organizationId === actor.organizationId ||
      client.ownerUserId === actor.id ||
      client.issuedByUserId === actor.id ||
      keys.some(
        (key) =>
          key.status === "active" &&
          key.clientId === client.id &&
          (key.issuedByUserId === actor.id || key.organizationId === actor.organizationId),
      )
    );
  }
  if (actor.role === "manager") {
    return (
      client.issuedByUserId === actor.id ||
      client.ownerUserId === actor.id ||
      Boolean(
        actor.organizationId &&
          (client.organizationId === actor.organizationId ||
            keys.some(
              (key) =>
                key.status === "active" &&
                key.clientId === client.id &&
                (key.issuedByUserId === actor.id || key.organizationId === actor.organizationId),
            )),
      )
    );
  }
  return false;
}

export function scopedClients(
  actor: PublicUser,
  clients: Client[],
  keys: AccessKeyRecord[] = [],
) {
  return clients.filter((client) => clientVisibleTo(actor, client, keys));
}

export function scopedOrders<
  T extends { clientId: string; createdByUserId?: string; organizationId?: string },
>(actor: PublicUser, orders: T[], clients: Client[], keys: AccessKeyRecord[] = []): T[] {
  if (actor.role === "admin") return orders;
  const allowed = new Set(scopedClients(actor, clients, keys).map((item) => item.id));
  return orders.filter((order) => {
    if (order.createdByUserId === actor.id) return true;
    if (actor.clientId && order.clientId === actor.clientId) return true;
    if (actor.organizationId && order.organizationId === actor.organizationId) return true;
    return allowed.has(order.clientId);
  });
}

export function activityVisibleTo(
  actor: PublicUser,
  event: {
    userId?: string;
    role?: UserRole;
    clientId?: string;
    organizationId?: string;
    issuedByUserId?: string;
  },
  keyedUserIds: Set<string>,
) {
  if (actor.role === "admin") return true;
  if (event.role === "admin") return false;
  if (event.userId === actor.id) return true;
  if (actor.role === "organization") {
    if (event.organizationId && event.organizationId === actor.organizationId) return true;
    if (event.issuedByUserId === actor.id) return true;
    if (event.userId && keyedUserIds.has(event.userId)) return true;
    return false;
  }
  if (actor.role === "manager") {
    if (event.issuedByUserId === actor.id) return true;
    if (event.userId && keyedUserIds.has(event.userId)) return true;
    if (actor.organizationId && event.organizationId === actor.organizationId) {
      return event.role === "client" || event.role === "guest" || event.role === "manager";
    }
    return false;
  }
  return false;
}

export function keyedUserIdsFor(
  actor: PublicUser,
  keys: AccessKeyRecord[],
  users: { id: string; issuedByUserId?: string; organizationId?: string; role?: UserRole }[],
) {
  const ids = new Set<string>();
  for (const key of keys) {
    if (key.status === "revoked") continue;
    const mine =
      key.issuedByUserId === actor.id ||
      (actor.organizationId && key.organizationId === actor.organizationId);
    if (!mine) continue;
    if (key.userId) ids.add(key.userId);
  }
  for (const user of users) {
    if (user.id === actor.id) continue;
    if (user.role === "admin") continue;
    if (user.issuedByUserId === actor.id) ids.add(user.id);
    if (actor.role === "organization" && user.organizationId === actor.organizationId) {
      ids.add(user.id);
    }
    if (
      actor.role === "manager" &&
      actor.organizationId &&
      user.organizationId === actor.organizationId &&
      user.role === "client"
    ) {
      ids.add(user.id);
    }
  }
  return ids;
}

export function exampleOrgId() {
  return EXAMPLE_ORG_ID;
}

export function scopedByOrganization<T extends { organizationId?: string }>(
  actor: PublicUser,
  items: T[],
): T[] {
  if (actor.role === "admin") {
    return items.filter((item) => !item.organizationId);
  }
  if (!actor.organizationId) return [];
  return items.filter((item) => item.organizationId === actor.organizationId);
}

export function scopedMoney<T extends { organizationId?: string }>(actor: PublicUser, items: T[]): T[] {
  if (actor.role === "admin") return items;
  if (!canSeeMoney(actor.role) || !actor.organizationId) return [];
  return items.filter((item) => item.organizationId === actor.organizationId);
}
