import { offerOems } from "@/lib/oem";
import { detectPairSide, isRelatedConsumable } from "@/lib/pairs";
import type { Client, Offer, PriceBand } from "@/lib/types";
import { clientSellPrice } from "@/lib/pricing";

export function applyPairFields(offer: Offer): Offer {
  const side = detectPairSide(`${offer.sku} ${offer.name} ${offer.displayName ?? ""}`);
  return { ...offer, pairSide: side || undefined };
}

export function applicabilityOf(offer: Offer) {
  if (offer.applicability?.trim()) return offer.applicability.trim();
  const fromSpecs =
    offer.specs?.["Применимость"] ||
    offer.specs?.Применимость ||
    offer.specs?.applicability ||
    "";
  if (fromSpecs.trim()) return fromSpecs.trim();
  if (offer.category && offer.category !== "Расходники") return offer.category;
  return "";
}

export function sellWarning(
  buy: number,
  bands: PriceBand[],
  fallbackMarkup: number,
  client?: Client | null,
  markupOverride?: number | null,
) {
  const sell = clientSellPrice(buy, bands, fallbackMarkup, client, markupOverride);
  if (sell + 0.009 < buy) {
    return `Цена клиенту ${sell.toFixed(2)} ₽ ниже закупа ${buy.toFixed(2)} ₽ — проверьте скидку и наценку.`;
  }
  return "";
}

export function relatedKind(offer: Offer, seed: Offer) {
  if (offer.id === seed.id) return "";
  const seedOems = new Set(offerOems(seed));
  const sameOem = offerOems(offer).some((oem) => seedOems.has(oem));
  if (isRelatedConsumable(offer.name) && sameOem) return "уплотнение";
  if (seed.pairSide && offer.pairSide && seed.pairSide !== offer.pairSide && sameOem) {
    return "пара";
  }
  if (offer.pairSide && seed.pairSide && offer.pairSide !== seed.pairSide) {
    const a = offer.sku.replace(/[LRА-Я]/gi, "");
    const b = seed.sku.replace(/[LRА-Я]/gi, "");
    if (a && a === b) return "пара";
  }
  return sameOem ? "кросс" : "";
}
