import type { Offer, Organization, PublicUser, Supplier } from "@/lib/types";

export function looksMaskedSecret(value?: string): boolean {
  if (!value) return true;
  return /[•…]/.test(value) || value.includes("...");
}

export function isAdminOwnedSupplier(supplier: Supplier): boolean {
  return (supplier.ownerRole ?? "admin") === "admin";
}

export function isOrgOwnedSupplier(supplier: Supplier, organizationId: string): boolean {
  return supplier.ownerRole === "organization" && supplier.ownerId === organizationId;
}

export function isSupplierLockedForOrg(supplier: Supplier): boolean {
  return isAdminOwnedSupplier(supplier) || Boolean(supplier.lockedByAdmin);
}

export function supplierSharedWithOrg(supplier: Supplier, organizationId: string): boolean {
  return (supplier.sharedWithOrgIds ?? []).includes(organizationId);
}

export function orgAllowsManagerSupplierEdit(orgs: Organization[], organizationId?: string): boolean {
  if (!organizationId) return false;
  const org = orgs.find((item) => item.id === organizationId);
  return Boolean(org?.managersCanEditSuppliers);
}

export function canSeeSupplierCatalog(actor: PublicUser | null | undefined): boolean {
  return actor?.role === "admin" || actor?.role === "organization" || actor?.role === "manager";
}

/** Нового поставщика в справочник заводит только администратор. */
export function canCreateSupplier(actor: PublicUser | null | undefined): boolean {
  return actor?.role === "admin";
}

export function canRequestSupplier(actor: PublicUser | null | undefined): boolean {
  return actor?.role === "organization" || actor?.role === "manager";
}

export function canManageSuppliers(actor: PublicUser | null | undefined, orgs: Organization[]): boolean {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "organization") return true;
  if (actor.role === "manager") {
    return orgAllowsManagerSupplierEdit(orgs, actor.organizationId);
  }
  return false;
}

export function supplierVisibleTo(supplier: Supplier, actor: PublicUser | null | undefined): boolean {
  if (!actor) return false;
  if (canSeeSupplierCatalog(actor)) return true;
  const orgId = actor.organizationId;
  if (!orgId) return false;
  if (actor.role === "client") {
    if (isOrgOwnedSupplier(supplier, orgId)) return true;
    if (isAdminOwnedSupplier(supplier) && supplierSharedWithOrg(supplier, orgId)) return true;
  }
  return false;
}

export function canEditSupplier(
  supplier: Supplier,
  actor: PublicUser | null | undefined,
  orgs: Organization[],
): boolean {
  if (!actor || !canManageSuppliers(actor, orgs)) return false;
  if (actor.role === "admin") return isAdminOwnedSupplier(supplier);
  if (!actor.organizationId) return false;
  if (isSupplierLockedForOrg(supplier)) return false;
  return isOrgOwnedSupplier(supplier, actor.organizationId);
}

export function canDeleteSupplier(
  supplier: Supplier,
  actor: PublicUser | null | undefined,
  orgs: Organization[],
): boolean {
  return canEditSupplier(supplier, actor, orgs);
}

export function visibleSuppliers(suppliers: Supplier[], actor: PublicUser | null | undefined): Supplier[] {
  if (!actor) return [];
  if (actor.role === "admin") return suppliers;
  return suppliers.filter((supplier) => supplierVisibleTo(supplier, actor));
}

export function catalogSupplierIds(suppliers: Supplier[], actor: PublicUser | null | undefined): Set<string> {
  if (!actor || actor.role === "admin") {
    return new Set(suppliers.map((item) => item.id));
  }
  if (actor.role === "guest" || (actor.role === "client" && !actor.organizationId)) {
    return new Set(suppliers.filter((item) => isAdminOwnedSupplier(item)).map((item) => item.id));
  }
  return new Set(visibleSuppliers(suppliers, actor).map((item) => item.id));
}

export function filterOffersForActor(
  offers: Offer[],
  suppliers: Supplier[],
  actor: PublicUser | null | undefined,
): Offer[] {
  if (!actor || actor.role === "admin") return offers;
  const ids = catalogSupplierIds(suppliers, actor);
  return offers.filter((offer) => ids.has(offer.supplierId));
}

export function sanitizeSupplierForActor(
  supplier: Supplier,
  actor: PublicUser | null | undefined,
  // Список организаций оставлен в сигнатуре: ключи больше не зависят от права редактировать.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgs: Organization[],
): Supplier {
  const locked = Boolean(actor && actor.role !== "admin" && isSupplierLockedForOrg(supplier));
  return {
    ...supplier,
    apiKey: supplier.apiKey ? "••••" : "",
    apiKey2: supplier.apiKey2 ? "••••" : "",
    apiUrl: locked ? "" : supplier.apiUrl,
  };
}

export function resolveSupplierSecrets(incoming: Supplier, current?: Supplier): Supplier {
  return {
    ...incoming,
    apiKey: looksMaskedSecret(incoming.apiKey) ? (current?.apiKey ?? "") : incoming.apiKey,
    apiKey2: looksMaskedSecret(incoming.apiKey2) ? (current?.apiKey2 ?? "") : incoming.apiKey2,
  };
}
