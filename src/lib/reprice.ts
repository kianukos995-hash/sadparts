import { findPriceOffer, queryPriceOffers } from "@/lib/catalog-query";
import { clientSellPrice } from "@/lib/pricing";
import type { Client, Offer, Order, OrderLine, PriceBand, Supplier } from "@/lib/types";

export type LineChange = {
  line: OrderLine;
  current: Offer | null;
  priceChanged: boolean;
  stockChanged: boolean;
  daysChanged: boolean;
  missing: boolean;
  currentBuy?: number;
  currentStock?: number;
  currentDays?: number;
  currentSell?: number;
};

export type FillPlan = {
  sku: string;
  qty: number;
  offers: { offer: Offer; take: number; sell: number }[];
  shortage: number;
};

export async function inspectOrderPrices(
  order: Order,
  suppliers: Supplier[],
  demoOffers: Offer[],
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
) {
  const changes: LineChange[] = [];
  for (const line of order.lines) {
    let current = await findPriceOffer(suppliers, demoOffers, line.offerId);
    if (!current) {
      const search = await queryPriceOffers(suppliers, demoOffers, {
        q: line.sku,
        qField: "sku",
        pageSize: 20,
      });
      current =
        search.offers.find(
          (item) =>
            item.sku.toLowerCase() === line.sku.toLowerCase() && item.supplierId === line.supplierId,
        ) ??
        search.offers.find((item) => item.sku.toLowerCase() === line.sku.toLowerCase()) ??
        null;
    }
    if (!current) {
      changes.push({ line, current: null, priceChanged: true, stockChanged: true, daysChanged: true, missing: true });
      continue;
    }
    const currentSell = clientSellPrice(current.price, bands, fallbackMarkup, client);
    const snapSell = line.snapshotSell ?? currentSell;
    changes.push({
      line,
      current,
      missing: false,
      priceChanged: Math.abs(current.price - line.buyPrice) > 0.009 || Math.abs(currentSell - snapSell) > 0.009,
      stockChanged: current.stock !== (line.snapshotStock ?? current.stock) || current.stock < line.qty,
      daysChanged: (current.deliveryDays || 0) !== (line.deliveryDays || 0),
      currentBuy: current.price,
      currentStock: current.stock,
      currentDays: current.deliveryDays,
      currentSell,
    });
  }
  return changes;
}

export async function suggestFills(
  lines: OrderLine[],
  suppliers: Supplier[],
  demoOffers: Offer[],
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
) {
  const plans: FillPlan[] = [];
  for (const line of lines) {
    const search = await queryPriceOffers(suppliers, demoOffers, {
      q: line.sku,
      qField: "sku",
      inStock: true,
      pageSize: 40,
    });
    const same = search.offers
      .filter((item) => item.sku.toLowerCase() === line.sku.toLowerCase() && item.stock > 0)
      .sort((a, b) => a.price - b.price);
    let left = line.qty;
    const picked: FillPlan["offers"] = [];
    for (const offer of same.slice(0, 2)) {
      if (left <= 0) break;
      const take = Math.min(left, offer.stock);
      picked.push({
        offer,
        take,
        sell: clientSellPrice(offer.price, bands, fallbackMarkup, client),
      });
      left -= take;
    }
    plans.push({ sku: line.sku, qty: line.qty, offers: picked, shortage: Math.max(0, left) });
  }
  return plans;
}

export function needsReprice(changes: LineChange[]) {
  return changes.some((item) => item.missing || item.priceChanged || item.stockChanged || item.daysChanged);
}
