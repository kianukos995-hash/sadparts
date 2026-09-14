import type {
  Order,
  PurchaseLine,
  PurchaseOrder,
  PublicUser,
  StoreSnapshot,
  WarehouseDoc,
  WarehouseLot,
} from "@/lib/types";

export const PURCHASE_PREFIX = "ЗП";
export const RECEIPT_PREFIX = "ПР";

export function lotKey(sku: string, brand: string, warehouse: string, organizationId?: string) {
  return `${organizationId || "admin"}::${sku.trim().toUpperCase()}::${brand.trim().toUpperCase()}::${warehouse.trim()}`;
}

export function sameWarehouseScope(lotOrg?: string, organizationId?: string) {
  return (lotOrg || undefined) === (organizationId || undefined);
}

export function ownQty(
  lots: WarehouseLot[],
  sku: string,
  brand: string,
  organizationId?: string,
  warehouse?: string,
) {
  const skuNorm = sku.trim().toUpperCase();
  const brandNorm = brand.trim().toUpperCase();
  return lots
    .filter(
      (lot) =>
        sameWarehouseScope(lot.organizationId, organizationId) &&
        lot.sku.trim().toUpperCase() === skuNorm &&
        lot.brand.trim().toUpperCase() === brandNorm &&
        (!warehouse || lot.warehouse === warehouse),
    )
    .reduce((sum, lot) => sum + lot.qty, 0);
}

export function parsePrefixedSerial(number: string, prefixes: string[]) {
  const alt = prefixes.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = new RegExp(`^(?:${alt})-(\\d+)$`, "i").exec(number.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function formatPrefixedNumber(prefix: string, serial: number) {
  return `${prefix}-${String(Math.max(1, serial)).padStart(4, "0")}`;
}

export function nextPrefixedNumber(
  numbers: string[],
  prefix: string,
  aliases: string[] = [],
) {
  const max = numbers.reduce(
    (acc, value) => Math.max(acc, parsePrefixedSerial(value, [prefix, ...aliases])),
    0,
  );
  return formatPrefixedNumber(prefix, max + 1);
}

export function nextPurchaseNumber(purchases: PurchaseOrder[], organizationId?: string) {
  const scoped = organizationId
    ? purchases.filter((item) => item.organizationId === organizationId)
    : purchases.filter((item) => !item.organizationId);
  return nextPrefixedNumber(
    scoped.map((item) => item.number),
    PURCHASE_PREFIX,
    ["ZP"],
  );
}

export function nextReceiptNumber(docs: WarehouseDoc[], organizationId?: string) {
  const scoped = docs.filter(
    (item) => item.kind === "in" && sameWarehouseScope(item.organizationId, organizationId),
  );
  return nextPrefixedNumber(
    scoped.map((item) => item.number),
    RECEIPT_PREFIX,
    ["PR"],
  );
}

function findLotIndex(lots: WarehouseLot[], sku: string, brand: string, warehouse: string, organizationId?: string) {
  const key = lotKey(sku, brand, warehouse, organizationId);
  return lots.findIndex(
    (lot) => lotKey(lot.sku, lot.brand, lot.warehouse, lot.organizationId) === key,
  );
}

export function applyLotDelta(
  lots: WarehouseLot[],
  line: { sku: string; brand: string; name?: string; qty: number; warehouse: string },
  organizationId: string | undefined,
  delta: number,
): WarehouseLot[] {
  const qty = Math.round(Number(line.qty) || 0);
  if (!line.sku.trim() || qty === 0) return lots;
  const warehouse = line.warehouse.trim() || "основной";
  const index = findLotIndex(lots, line.sku, line.brand, warehouse, organizationId);
  const current = index >= 0 ? lots[index] : undefined;
  const nextQty = (current?.qty ?? 0) + delta;
  if (delta < 0 && nextQty < -0.0001) {
    throw new Error(`На своём складе нет столько: ${line.sku} ${line.brand}`);
  }
  if (!current) {
    if (nextQty <= 0) return lots;
    return [
      ...lots,
      {
        id: crypto.randomUUID(),
        sku: line.sku.trim(),
        brand: line.brand.trim(),
        name: line.name?.trim() || line.sku,
        qty: nextQty,
        warehouse,
        organizationId,
      },
    ];
  }
  const next = lots.map((lot, i) => (i === index ? { ...lot, qty: nextQty, name: lot.name || line.name || lot.sku } : lot));
  return next.filter((lot) => lot.qty > 0.0001);
}

export function emptyPurchase(
  purchases: PurchaseOrder[],
  supplierId: string,
  ownerUserId: string,
  organizationId?: string,
): PurchaseOrder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: nextPurchaseNumber(purchases, organizationId),
    status: "draft",
    supplierId,
    organizationId,
    ownerUserId,
    comment: "",
    createdAt: now,
    updatedAt: now,
    lines: [],
  };
}

export function emptyPurchaseLine(): PurchaseLine {
  return {
    id: crypto.randomUUID(),
    sku: "",
    brand: "",
    name: "",
    qty: 1,
    warehouse: "основной",
  };
}

export function applyPurchasePosting(
  store: StoreSnapshot,
  purchase: PurchaseOrder,
  user: PublicUser,
): StoreSnapshot {
  if (purchase.status === "posted") return store;
  const organizationId = purchase.organizationId || user.organizationId || undefined;
  let lots = store.warehouseLots ?? [];
  for (const line of purchase.lines) {
    lots = applyLotDelta(lots, line, organizationId, line.qty);
  }
  const doc: WarehouseDoc = {
    id: crypto.randomUUID(),
    kind: "in",
    number: purchase.number,
    at: new Date().toISOString(),
    party: purchase.supplierId,
    supplierId: purchase.supplierId,
    purchaseId: purchase.id,
    organizationId,
    createdByUserId: user.id,
    lines: purchase.lines.map((line) => ({
      sku: line.sku,
      brand: line.brand,
      qty: line.qty,
      warehouse: line.warehouse || "основной",
    })),
  };
  const now = new Date().toISOString();
  const posted: PurchaseOrder = { ...purchase, status: "posted", postedAt: now, updatedAt: now, organizationId };
  const purchases = (store.purchases ?? []).some((item) => item.id === posted.id)
    ? (store.purchases ?? []).map((item) => (item.id === posted.id ? posted : item))
    : [posted, ...(store.purchases ?? [])];
  return {
    ...store,
    purchases,
    warehouseLots: lots,
    warehouseDocs: [doc, ...(store.warehouseDocs ?? [])],
  };
}

export function reversePurchasePosting(store: StoreSnapshot, purchase: PurchaseOrder): StoreSnapshot {
  if (purchase.status !== "posted") return store;
  const organizationId = purchase.organizationId || undefined;
  let lots = store.warehouseLots ?? [];
  for (const line of purchase.lines) {
    lots = applyLotDelta(lots, line, organizationId, -line.qty);
  }
  const purchases = (store.purchases ?? []).map((item) =>
    item.id === purchase.id
      ? { ...item, status: "draft" as const, postedAt: undefined, updatedAt: new Date().toISOString() }
      : item,
  );
  return {
    ...store,
    purchases,
    warehouseLots: lots,
    warehouseDocs: (store.warehouseDocs ?? []).filter((doc) => doc.purchaseId !== purchase.id),
  };
}

export function applyReceipt(
  store: StoreSnapshot,
  input: {
    supplierId?: string;
    party: string;
    comment?: string;
    lines: { sku: string; brand: string; name?: string; qty: number; warehouse: string }[];
    organizationId?: string;
    createdByUserId: string;
    purchaseId?: string;
    number?: string;
  },
): StoreSnapshot {
  const organizationId = input.organizationId || undefined;
  const lines = input.lines.filter((line) => line.sku.trim() && line.qty > 0);
  if (lines.length === 0) throw new Error("Добавьте позиции прихода");
  let lots = store.warehouseLots ?? [];
  for (const line of lines) {
    lots = applyLotDelta(lots, line, organizationId, line.qty);
  }
  const number =
    input.number || nextReceiptNumber(store.warehouseDocs ?? [], organizationId);
  const doc: WarehouseDoc = {
    id: crypto.randomUUID(),
    kind: "in",
    number,
    at: new Date().toISOString(),
    party: input.party,
    supplierId: input.supplierId,
    purchaseId: input.purchaseId,
    organizationId,
    createdByUserId: input.createdByUserId,
    lines: lines.map((line) => ({
      sku: line.sku,
      brand: line.brand,
      qty: line.qty,
      warehouse: line.warehouse || "основной",
    })),
  };
  return {
    ...store,
    warehouseLots: lots,
    warehouseDocs: [doc, ...(store.warehouseDocs ?? [])],
  };
}

function ownLines(order: Order) {
  return order.lines.filter((line) => line.fulfillFrom === "own");
}

export function applyOrderWarehouseOut(
  store: StoreSnapshot,
  order: Order,
  user: PublicUser,
): StoreSnapshot {
  const lines = ownLines(order);
  if (lines.length === 0) return store;
  const organizationId = order.organizationId || user.organizationId || undefined;
  let lots = store.warehouseLots ?? [];
  for (const line of lines) {
    lots = applyLotDelta(
      lots,
      { sku: line.sku, brand: line.brand, name: line.name, qty: line.qty, warehouse: line.warehouse || "основной" },
      organizationId,
      -line.qty,
    );
  }
  const doc: WarehouseDoc = {
    id: crypto.randomUUID(),
    kind: "out",
    number: order.number,
    at: new Date().toISOString(),
    party: order.clientId || user.name,
    clientId: order.clientId,
    orderId: order.id,
    organizationId,
    createdByUserId: user.id,
    lines: lines.map((line) => ({
      sku: line.sku,
      brand: line.brand,
      qty: line.qty,
      warehouse: line.warehouse || "основной",
    })),
  };
  return {
    ...store,
    warehouseLots: lots,
    warehouseDocs: [doc, ...(store.warehouseDocs ?? []).filter((item) => item.orderId !== order.id)],
  };
}

export function reverseOrderWarehouseOut(store: StoreSnapshot, order: Order): StoreSnapshot {
  const lines = ownLines(order);
  if (lines.length === 0) {
    return {
      ...store,
      warehouseDocs: (store.warehouseDocs ?? []).filter((item) => item.orderId !== order.id),
    };
  }
  const organizationId = order.organizationId || undefined;
  let lots = store.warehouseLots ?? [];
  for (const line of lines) {
    lots = applyLotDelta(
      lots,
      { sku: line.sku, brand: line.brand, name: line.name, qty: line.qty, warehouse: line.warehouse || "основной" },
      organizationId,
      line.qty,
    );
  }
  return {
    ...store,
    warehouseLots: lots,
    warehouseDocs: (store.warehouseDocs ?? []).filter((item) => item.orderId !== order.id),
  };
}

export function isPostedStatus(status: Order["status"]) {
  return status === "assembled" || status === "sent";
}

export function adminInvoiceOrders<T extends { organizationId?: string }>(items: T[]) {
  return items.filter((item) => !item.organizationId);
}

export function orgInvoiceOrders<T extends { organizationId?: string }>(items: T[], organizationId?: string) {
  if (!organizationId) return [];
  return items.filter((item) => item.organizationId === organizationId);
}
