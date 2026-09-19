import { computeManagerKpi } from "../src/lib/hr";
import {
  canCreateSupplier,
  canEditSupplier,
  canManageSuppliers,
  canRequestSupplier,
  catalogSupplierIds,
  filterOffersForActor,
  looksMaskedSecret,
  resolveSupplierSecrets,
  supplierVisibleTo,
} from "../src/lib/suppliers-scope";
import type {
  ManagerMembership,
  Offer,
  Organization,
  PublicUser,
  ScheduleDay,
  Supplier,
} from "../src/lib/types";
import { DEFAULT_COLUMN_MAP } from "../src/lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

function supplier(partial: Partial<Supplier> & Pick<Supplier, "id" | "name">): Supplier {
  return {
    id: partial.id,
    name: partial.name,
    code: partial.code ?? partial.name.slice(0, 6).toUpperCase(),
    source: partial.source ?? "api",
    adapter: partial.adapter ?? "generic",
    apiUrl: partial.apiUrl ?? "https://example.test",
    apiKey: partial.apiKey ?? "secret",
    apiKey2: partial.apiKey2 ?? "",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    itemsPath: "items",
    columnMap: { ...DEFAULT_COLUMN_MAP },
    notes: "",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    deliveryDaysMoscow: 2,
    deliveryNote: "",
    ownerRole: partial.ownerRole ?? "admin",
    ownerId: partial.ownerId,
    lockedByAdmin: partial.lockedByAdmin,
    sharedWithOrgIds: partial.sharedWithOrgIds,
  };
}

function main() {
  const admin: PublicUser = {
    id: "usr-admin",
    email: "admin@sadparts.local",
    name: "Admin",
    role: "admin",
    status: "active",
  };
  const org: PublicUser = {
    id: "usr-org",
    email: "org@sadparts.local",
    name: "Org",
    role: "organization",
    status: "active",
    organizationId: "org-1",
  };
  const manager: PublicUser = {
    id: "usr-mgr",
    email: "manager@sadparts.local",
    name: "Mgr",
    role: "manager",
    status: "active",
    organizationId: "org-1",
  };
  const guest: PublicUser = {
    id: "usr-guest",
    email: "guest@sadparts.local",
    name: "Guest",
    role: "guest",
    status: "active",
  };
  const client: PublicUser = {
    id: "usr-cli",
    email: "cli@sadparts.local",
    name: "Client",
    role: "client",
    status: "active",
    organizationId: "org-1",
  };
  const orgs: Organization[] = [
    {
      id: "org-1",
      name: "Орг",
      inn: "",
      phone: "",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdByUserId: "usr-admin",
      discountPercent: 0,
      managersCanEditSuppliers: false,
    },
  ];
  const locked = supplier({
    id: "sup-admin",
    name: "Админ",
    ownerRole: "admin",
    lockedByAdmin: true,
    sharedWithOrgIds: ["org-1"],
    apiKey: "rk_live",
  });
  const own = supplier({
    id: "sup-org",
    name: "Свой",
    ownerRole: "organization",
    ownerId: "org-1",
    lockedByAdmin: false,
    apiKey: "org-secret",
  });
  const privateAdmin = supplier({
    id: "sup-hidden",
    name: "Скрыт",
    ownerRole: "admin",
    lockedByAdmin: true,
    sharedWithOrgIds: [],
  });

  assert(supplierVisibleTo(locked, org), "org sees shared");
  assert(supplierVisibleTo(own, org), "org sees own");
  assert(supplierVisibleTo(privateAdmin, org), "org sees all suppliers including unshared");
  assert(supplierVisibleTo(locked, manager), "manager sees all");
  assert(!canCreateSupplier(org), "org cannot create");
  assert(!canCreateSupplier(manager), "manager cannot create");
  assert(canCreateSupplier(admin), "admin creates");
  assert(canRequestSupplier(org) && canRequestSupplier(manager), "desk request");
  assert(!canRequestSupplier(client) && !canRequestSupplier(guest), "client/guest no request");
  assert(!canEditSupplier(locked, org, orgs), "locked not editable");
  assert(canEditSupplier(own, org, orgs), "own editable");
  assert(!canEditSupplier(own, admin, orgs), "admin does not overwrite org private");
  assert(canEditSupplier(locked, admin, orgs), "admin edits own");
  assert(!canManageSuppliers(manager, orgs), "manager blocked by default");
  assert(!canManageSuppliers(guest, orgs), "guest no suppliers");
  assert(!canManageSuppliers(client, orgs), "client no suppliers");
  orgs[0].managersCanEditSuppliers = true;
  assert(canManageSuppliers(manager, orgs), "manager allowed by org");
  assert(canEditSupplier(own, manager, orgs), "manager edits org own");
  assert(!canEditSupplier(locked, manager, orgs), "manager cannot edit locked");

  const ids = catalogSupplierIds([locked, own, privateAdmin], org);
  assert(ids.has("sup-admin") && ids.has("sup-org") && ids.has("sup-hidden"), "org sees all in catalog");
  const guestIds = catalogSupplierIds([locked, own, privateAdmin], guest);
  assert(guestIds.has("sup-admin") && !guestIds.has("sup-org"), "guest only admin-owned");

  const offers: Offer[] = [
    {
      id: "a",
      supplierId: "sup-org",
      sku: "A",
      brand: "B",
      name: "n",
      oem: "",
      crossOems: [],
      category: "",
      price: 1,
      currency: "RUB",
      stock: 1,
      warehouse: "",
      multiplicity: 1,
      deliveryDays: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "api",
    },
    {
      id: "b",
      supplierId: "sup-hidden",
      sku: "B",
      brand: "B",
      name: "n",
      oem: "",
      crossOems: [],
      category: "",
      price: 1,
      currency: "RUB",
      stock: 1,
      warehouse: "",
      multiplicity: 1,
      deliveryDays: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "api",
    },
  ];
  const filtered = filterOffersForActor(offers, [locked, own, privateAdmin], org);
  assert(filtered.length === 2, "org offers include all suppliers");

  assert(looksMaskedSecret("••••"), "mask");
  assert(!looksMaskedSecret("live-key"), "live");
  const resolved = resolveSupplierSecrets(
    { ...own, apiKey: "••••", apiKey2: "new-two" },
    own,
  );
  assert(resolved.apiKey === "org-secret", "keep masked");
  assert(resolved.apiKey2 === "new-two", "set second");

  const membership: ManagerMembership = {
    id: "mem",
    userId: "usr-mgr",
    organizationId: "org-1",
    incomePercent: 10,
    incomeFixed: 100,
    shiftRate: 2000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const kpi = computeManagerKpi(
    membership,
    [
      {
        id: "o1",
        number: "ЗК-0001",
        status: "assembled",
        clientId: "c",
        markupPercent: 0,
        comment: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdByUserId: "usr-mgr",
        organizationId: "org-1",
        postedAt: "2026-01-02T00:00:00.000Z",
        lines: [
          {
            id: "l1",
            offerId: "a",
            supplierId: "sup-org",
            sku: "A",
            brand: "B",
            name: "n",
            oem: "",
            qty: 2,
            buyPrice: 100,
            currency: "RUB",
            deliveryDays: 1,
            warehouse: "",
            snapshotSell: 150,
          },
        ],
      },
    ],
    [
      {
        date: "2026-03-01",
        userId: "usr-mgr",
        organizationId: "org-1",
        mark: "work",
      } satisfies ScheduleDay,
      {
        date: "2026-03-02",
        userId: "usr-mgr",
        organizationId: "org-1",
        mark: "vacation",
      },
    ],
    2026,
  );
  assert(kpi.orderCount === 1, "kpi orders");
  assert(kpi.volume === 300, `volume ${kpi.volume}`);
  assert(kpi.percentPart === 30, `percent ${kpi.percentPart}`);
  assert(kpi.fixedPart === 100, `fixed ${kpi.fixedPart}`);
  assert(kpi.workDays === 1, "work days");
  assert(kpi.shiftPart === 2000, "shift");
  assert(kpi.total === 2130, `total ${kpi.total}`);

  console.log("suppliers-hr-check ok");
}

main();
