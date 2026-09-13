import type { Client, PriceBand } from "@/lib/types";
import { markupForPrice } from "@/lib/price-bands";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sellUnitPrice(buy: number, markupPercent: number, discountPercent: number) {
  const marked = buy * (1 + (markupPercent || 0) / 100);
  return roundMoney(marked * (1 - (discountPercent || 0) / 100));
}

/** Скидка % от цены с наценкой, при которой продажа падает ниже закупа. */
export function discountBreakEvenPercent(markupPercent: number) {
  const markup = Math.max(0, markupPercent || 0);
  if (markup <= 0) return 0;
  return roundMoney((markup / (100 + markup)) * 100);
}

export function isSellBelowBuy(buy: number, markupPercent: number, discountPercent: number) {
  return sellUnitPrice(buy, markupPercent, discountPercent) + 0.009 < buy;
}

export function lineTotal(buy: number, qty: number, markupPercent: number, discountPercent: number) {
  return roundMoney(sellUnitPrice(buy, markupPercent, discountPercent) * qty);
}

export function clientSellPrice(
  buy: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  const markup =
    markupOverride == null
      ? markupForPrice(buy, bands, fallbackMarkup, client)
      : markupOverride;
  return sellUnitPrice(buy, markup, client?.discountPercent ?? 0);
}

export function clientLineTotal(
  buy: number,
  qty: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  return roundMoney(clientSellPrice(buy, bands, fallbackMarkup, client, markupOverride) * qty);
}
