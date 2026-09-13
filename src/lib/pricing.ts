export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sellUnitPrice(buy: number, markupPercent: number, discountPercent: number) {
  const marked = buy * (1 + (markupPercent || 0) / 100);
  return roundMoney(marked * (1 - (discountPercent || 0) / 100));
}

export function lineTotal(buy: number, qty: number, markupPercent: number, discountPercent: number) {
  return roundMoney(sellUnitPrice(buy, markupPercent, discountPercent) * qty);
}
