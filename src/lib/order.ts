import type { Client, Offer, Order, OrderLine } from "@/lib/types";
import { offerTitle } from "@/lib/oem";

export const ORDER_PREFIX = "ЗК";

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
    vendorCode: offer.vendorCode,
  };
}

export function parseOrderSerial(number: string) {
  const match = /^(?:ЗК|ZK|SP)-(\d+)$/i.exec(number.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function formatOrderNumber(serial: number) {
  return `${ORDER_PREFIX}-${String(Math.max(1, serial)).padStart(4, "0")}`;
}

export function nextOrderNumber(orders: Order[]) {
  const max = orders.reduce((acc, order) => Math.max(acc, parseOrderSerial(order.number)), 0);
  return formatOrderNumber(max + 1);
}

export function copyClientVehicle(client?: Client | null) {
  if (!client) return {};
  return {
    car: client.car ?? "",
    vin: client.vin ?? "",
    plate: client.plate ?? "",
    year: client.year ?? "",
    color: client.color ?? "",
  };
}

export function emptyDraft(
  orders: Order[],
  clients: Client[],
  markupPercent: number,
  clientId?: string,
): Order {
  const now = new Date().toISOString();
  const chosen = clientId ?? clients[0]?.id ?? "";
  const client = clients.find((item) => item.id === chosen);
  return {
    id: crypto.randomUUID(),
    number: nextOrderNumber(orders),
    status: "draft",
    clientId: chosen,
    markupPercent,
    comment: "",
    createdAt: now,
    updatedAt: now,
    lines: [],
    ...copyClientVehicle(client),
  };
}

export function findDraft(orders: Order[]) {
  return orders.find((order) => order.status === "draft") ?? null;
}

export function findDrafts(orders: Order[]) {
  return orders
    .filter((order) => order.status === "draft")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function findDraftForClient(orders: Order[], clientId: string) {
  return findDrafts(orders).find((order) => order.clientId === clientId) ?? null;
}

export function whatsappDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

export function whatsappOrderUrl(phone: string, text: string) {
  const digits = whatsappDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
