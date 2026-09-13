import type { Client, PriceBand } from "@/lib/types";
import { markupForPrice } from "@/lib/price-bands";

export type PriceBreakdown = {
  buy: number;
  markupPercent: number;
  markupAmount: number;
  marked: number;
  discountPercent: number;
  discountAmount: number;
  sell: number;
  belowBuy: boolean;
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function num(value: number | undefined | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

/**
 * Цена клиенту = закупочная + наценка по категории − скидка клиента.
 * Наценка считается от закупа, скидка — от цены с наценкой.
 * Пример: 1000 ₽, коридор 16%, скидка 8% → 1000 + 160 − 92.80 = 1067.20
 */
export function priceBreakdown(
  buyPrice: number,
  markupPercent: number,
  discountPercent: number,
): PriceBreakdown {
  const buy = Math.max(0, num(buyPrice));
  const markupPct = num(markupPercent);
  const discountPct = Math.min(100, Math.max(-100, num(discountPercent)));
  const markupAmount = roundMoney(buy * (markupPct / 100));
  const marked = roundMoney(buy + markupAmount);
  const discountAmount = roundMoney(marked * (discountPct / 100));
  const sell = roundMoney(Math.max(0, marked - discountAmount));
  return {
    buy,
    markupPercent: markupPct,
    markupAmount,
    marked,
    discountPercent: discountPct,
    discountAmount,
    sell,
    belowBuy: sell + 0.009 < buy,
  };
}

export function sellUnitPrice(buy: number, markupPercent: number, discountPercent: number) {
  return priceBreakdown(buy, markupPercent, discountPercent).sell;
}

/** Скидка % от цены с наценкой, при которой продажа падает ниже закупа. */
export function discountBreakEvenPercent(markupPercent: number) {
  const markup = Math.max(0, num(markupPercent));
  if (markup <= 0) return 0;
  return roundMoney((markup / (100 + markup)) * 100);
}

export function isSellBelowBuy(buy: number, markupPercent: number, discountPercent: number) {
  return priceBreakdown(buy, markupPercent, discountPercent).belowBuy;
}

export function lineTotal(buy: number, qty: number, markupPercent: number, discountPercent: number) {
  return roundMoney(sellUnitPrice(buy, markupPercent, discountPercent) * Math.max(0, qty));
}

export function resolvedMarkupPercent(
  buy: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  return markupOverride == null
    ? markupForPrice(buy, bands, fallbackMarkup, client)
    : markupOverride;
}

export function clientPriceBreakdown(
  buy: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  const markup = resolvedMarkupPercent(buy, bands, fallbackMarkup, client, markupOverride);
  return priceBreakdown(buy, markup, client?.discountPercent ?? 0);
}

export function clientSellPrice(
  buy: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  return clientPriceBreakdown(buy, bands, fallbackMarkup, client, markupOverride).sell;
}

export function clientLineTotal(
  buy: number,
  qty: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  return roundMoney(clientSellPrice(buy, bands, fallbackMarkup, client, markupOverride) * Math.max(0, qty));
}

export function formatPriceFormula(b: PriceBreakdown) {
  const money = (value: number) =>
    `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
  return `${money(b.buy)} + ${money(b.markupAmount)} − ${money(b.discountAmount)} = ${money(b.sell)}`;
}

export function formatPriceFormulaHint(b: PriceBreakdown) {
  return `закуп ${b.buy.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽ + наценка ${b.markupPercent}% (${b.markupAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽) − скидка ${b.discountPercent}% (${b.discountAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽)`;
}
