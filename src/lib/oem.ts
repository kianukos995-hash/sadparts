import { normalizeSku } from "@/lib/format";
import type { Offer } from "@/lib/types";

export function offerTitle(offer: Offer) {
  return offer.displayName?.trim() || offer.name;
}

export function offerOems(offer: Offer) {
  const list = [offer.oem, ...(offer.crossOems ?? [])]
    .map((item) => normalizeSku(item))
    .filter(Boolean);
  return Array.from(new Set(list));
}

export function familyKey(offer: Offer) {
  return offerOems(offer)[0] || `sku:${normalizeSku(offer.sku)}:${offer.brand}`;
}

export function relatedOffers(offers: Offer[], seed: Offer) {
  const oems = new Set(offerOems(seed));
  const skus = new Set([normalizeSku(seed.sku)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const offer of offers) {
      const own = offerOems(offer);
      const sku = normalizeSku(offer.sku);
      const linked = own.some((oem) => oems.has(oem)) || skus.has(sku);
      if (!linked) continue;
      for (const oem of own) {
        if (!oems.has(oem)) {
          oems.add(oem);
          changed = true;
        }
      }
      if (!sku || skus.has(sku)) continue;
      skus.add(sku);
      changed = true;
    }
  }
  return offers.filter(
    (offer) => offerOems(offer).some((oem) => oems.has(oem)) || skus.has(normalizeSku(offer.sku)),
  );
}

export function searchHaystack(offer: Offer) {
  return [offer.sku, offer.brand, offerTitle(offer), ...offerOems(offer), offer.category]
    .join(" ")
    .toLowerCase();
}

function unionParent() {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    if (!parent.has(key)) parent.set(key, key);
    const current = parent.get(key)!;
    if (current !== key) parent.set(key, find(current));
    return parent.get(key)!;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  return { find, union };
}

export function groupByOem(offers: Offer[]) {
  const { find, union } = unionParent();
  for (const offer of offers) {
    const oems = offerOems(offer);
    if (oems.length === 0) {
      find(familyKey(offer));
      continue;
    }
    for (let index = 1; index < oems.length; index += 1) {
      union(oems[0], oems[index]);
    }
  }

  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const oems = offerOems(offer);
    const key = oems.length ? find(oems[0]) : familyKey(offer);
    const list = groups.get(key) ?? [];
    list.push(offer);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) => a.price - b.price || (a.deliveryDays || 99) - (b.deliveryDays || 99),
      );
      const allOems = Array.from(new Set(sorted.flatMap((item) => offerOems(item))));
      return {
        key,
        oem: allOems[0] ?? "",
        oems: allOems,
        name: offerTitle(sorted[0]),
        brands: Array.from(new Set(sorted.map((item) => item.brand))),
        minPrice: sorted[0]?.price ?? 0,
        maxPrice: sorted[sorted.length - 1]?.price ?? 0,
        minDays: Math.min(...sorted.map((item) => item.deliveryDays || 99)),
        stock: sorted.reduce((sum, item) => sum + item.stock, 0),
        offers: sorted,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
