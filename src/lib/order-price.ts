import type { Client, Order, OrderLine, PriceBand } from "@/lib/types";
import { clientPriceBreakdown, roundMoney, type PriceBreakdown } from "@/lib/pricing";

export type PricedLine = OrderLine & {
  sell: number;
  sum: number;
  breakdown: PriceBreakdown;
};

export function priceOrder(
  order: Order,
  client: Client | null | undefined,
  bands: PriceBand[],
  fallbackMarkup: number,
  markupOverride?: number | null,
) {
  const lines: PricedLine[] = order.lines.map((line) => {
    const breakdown = clientPriceBreakdown(
      line.buyPrice,
      bands,
      fallbackMarkup,
      client,
      markupOverride,
    );
    const sell = breakdown.sell;
    return {
      ...line,
      sell,
      sum: roundMoney(sell * line.qty),
      breakdown,
    };
  });
  const qty = lines.reduce((sum, line) => sum + line.qty, 0);
  const buy = roundMoney(lines.reduce((sum, line) => sum + line.buyPrice * line.qty, 0));
  const sell = roundMoney(lines.reduce((sum, line) => sum + line.sum, 0));
  const markup = roundMoney(lines.reduce((sum, line) => sum + line.breakdown.markupAmount * line.qty, 0));
  const discount = roundMoney(
    lines.reduce((sum, line) => sum + line.breakdown.discountAmount * line.qty, 0),
  );
  return { lines, totals: { qty, buy, sell, markup, discount } };
}

export function includedVat(total: number, vatPercent: number) {
  const vat = Number.isFinite(vatPercent) ? vatPercent : 0;
  if (vat <= 0) return 0;
  return roundMoney((total * vat) / (100 + vat));
}

export function lineCaption(line: OrderLine) {
  const name = line.name.trim();
  const brand = line.brand.trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${name} (${brand})`;
  }
  return name || brand || line.sku;
}
