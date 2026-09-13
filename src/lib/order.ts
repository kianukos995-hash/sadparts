import type { Client, Offer, Order, OrderLine } from "@/lib/types";
import { offerTitle } from "@/lib/oem";

export function offerToLine(offer: Offer, qty = 1): OrderLine {
  const step = Math.max(1, offer.multiplicity || 1);
  const count = Math.max(step, Math.ceil(qty / step) * step);
  return {
    id: crypto.randomUUID(),
    offerId: offer.id,
    supplierId: offer.supplierId,
    sku: offer.sku,
    brand: offer.brand,
    name: offerTitle(offer),
    oem: offer.oem,
    qty: count,
    buyPrice: offer.price,
    currency: offer.currency || "RUB",
    deliveryDays: offer.deliveryDays || 0,
    warehouse: offer.warehouse,
    guid: offer.guid,
    stockId: offer.stockId,
  };
}

export function nextOrderNumber(orders: Order[]) {
  const max = orders.reduce((acc, order) => {
    const match = /^SP-(\d+)$/.exec(order.number);
    return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  return `SP-${String(max + 1).padStart(4, "0")}`;
}

export function emptyDraft(orders: Order[], clients: Client[], markupPercent: number): Order {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: nextOrderNumber(orders),
    status: "draft",
    clientId: clients[0]?.id ?? "",
    markupPercent,
    comment: "",
    createdAt: now,
    updatedAt: now,
    lines: [],
  };
}

export function findDraft(orders: Order[]) {
  return orders.find((order) => order.status === "draft") ?? null;
}
