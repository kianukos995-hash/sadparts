import { findPriceOffer, queryPriceOffers } from "@/lib/catalog-query";
import { normalizeSku } from "@/lib/format";
import { clientSellPrice } from "@/lib/pricing";
import type { Client, Offer, Order, OrderLine, PriceBand, Supplier } from "@/lib/types";

export type LineChange = {
  line: OrderLine;
  current: Offer | null;
  priceChanged: boolean;
  stockChanged: boolean;
  stockShortage: boolean;
  daysChanged: boolean;
  missing: boolean;
  skuMismatch: boolean;
  offerMismatch: boolean;
  currentBuy?: number;
  currentStock?: number;
  currentDays?: number;
  currentSell?: number;
  reasons: string[];
};

export type FillPlan = {
  sku: string;
  qty: number;
  offers: { offer: Offer; take: number; sell: number }[];
  shortage: number;
};

function reasonsOf(change: Omit<LineChange, "reasons">): string[] {
  if (change.missing) return ["позиции нет в актуальном прайсе"];
  const out: string[] = [];
  if (change.skuMismatch) out.push("артикул не совпадает с прайсом");
  if (change.offerMismatch) out.push("склад или предложение изменились");
  if (change.stockShortage) out.push("не хватает количества");
  else if (change.stockChanged) out.push("остаток изменился");
  if (change.priceChanged) out.push("цена изменилась");
  if (change.daysChanged) out.push("срок изменился");
  return out;
}

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
            normalizeSku(item.sku) === normalizeSku(line.sku) &&
            item.supplierId === line.supplierId &&
            (item.warehouse || "") === (line.warehouse || ""),
        ) ??
        search.offers.find(
          (item) =>
            normalizeSku(item.sku) === normalizeSku(line.sku) && item.supplierId === line.supplierId,
        ) ??
        search.offers.find((item) => normalizeSku(item.sku) === normalizeSku(line.sku)) ??
        null;
    }
    if (!current) {
      const missing: LineChange = {
        line,
        current: null,
        priceChanged: true,
        stockChanged: true,
        stockShortage: true,
        daysChanged: true,
        missing: true,
        skuMismatch: true,
        offerMismatch: true,
        reasons: [],
      };
      missing.reasons = reasonsOf(missing);
      changes.push(missing);
      continue;
    }
    const currentSell = clientSellPrice(current.price, bands, fallbackMarkup, client);
    const snapSell = line.snapshotSell ?? currentSell;
    const skuMismatch = normalizeSku(current.sku) !== normalizeSku(line.sku);
    const offerMismatch =
      current.id !== line.offerId || (current.warehouse || "") !== (line.warehouse || "");
    const stockShortage = current.stock < line.qty;
    const snapStock = line.snapshotStock;
    const stockChanged =
      stockShortage || (snapStock != null && current.stock !== snapStock);
    const change: LineChange = {
      line,
      current,
      missing: false,
      skuMismatch,
      offerMismatch,
      stockShortage,
      priceChanged: Math.abs(current.price - line.buyPrice) > 0.009 || Math.abs(currentSell - snapSell) > 0.009,
      stockChanged,
      daysChanged: (current.deliveryDays || 0) !== (line.deliveryDays || 0),
      currentBuy: current.price,
      currentStock: current.stock,
      currentDays: current.deliveryDays,
      currentSell,
      reasons: [],
    };
    change.reasons = reasonsOf(change);
    changes.push(change);
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
      .filter((item) => normalizeSku(item.sku) === normalizeSku(line.sku) && item.stock > 0)
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

export function lineNeedsReprice(item: LineChange) {
  return (
    item.missing ||
    item.skuMismatch ||
    item.offerMismatch ||
    item.stockShortage ||
    item.stockChanged ||
    item.priceChanged ||
    item.daysChanged
  );
}

export function needsReprice(changes: LineChange[]) {
  return changes.some(lineNeedsReprice);
}

export function matchesLiveCatalog(offer: Offer, change: LineChange) {
  if (normalizeSku(offer.sku) !== normalizeSku(change.line.sku)) return false;
  if (offer.stock < change.line.qty && offer.stock <= 0) return false;
  if (change.missing) return offer.stock > 0;
  if (change.offerMismatch || change.stockShortage) {
    return (
      offer.supplierId === change.line.supplierId &&
      (offer.warehouse || "") === (change.line.warehouse || "")
        ? offer.stock >= change.line.qty
        : offer.stock > 0
    );
  }
  return offer.stock > 0;
}
