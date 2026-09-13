import type { Offer, Order } from "@/lib/types";

export function reservedQty(orders: Order[], offerId: string) {
  let qty = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.offerId === offerId) qty += line.qty;
    }
  }
  return qty;
}

export function availableStock(offer: Offer, orders: Order[]) {
  return (offer.stock || 0) - reservedQty(orders, offer.id);
}

export function formatFreeStock(free: number, reserved = 0) {
  if (free < 0) return `${free} шт.`;
  if (free === 0) return reserved ? "занято" : "нет";
  return `${free} шт.`;
}
