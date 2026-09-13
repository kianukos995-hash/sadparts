import { formatMoney, formatStock, normalizeSku } from "@/lib/format";
import { offerOems, offerTitle, relatedOffers, searchHaystack } from "@/lib/oem";
import type { Offer, StoreSnapshot, Supplier } from "@/lib/types";

export function searchOffers(store: StoreSnapshot, query: string, limit = 8) {
  const q = normalizeSku(query).toLowerCase() || query.trim().toLowerCase();
  if (!q) return [];
  const names = new Map(store.suppliers.map((supplier) => [supplier.id, supplier.name]));
  const scored = store.offers
    .map((offer) => {
      const hay = searchHaystack(offer);
      const sku = normalizeSku(offer.sku).toLowerCase();
      const oems = offerOems(offer).map((item) => item.toLowerCase());
      let score = 0;
      if (sku === q || oems.includes(q)) score = 100;
      else if (sku.includes(q) || oems.some((oem) => oem.includes(q))) score = 70;
      else if (hay.includes(query.trim().toLowerCase())) score = 40;
      return { offer, score, supplierName: names.get(offer.supplierId) ?? "поставщик" };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.offer.price - b.offer.price);
  return scored.slice(0, limit);
}

export function offersForPart(store: StoreSnapshot, offer: Offer) {
  return relatedOffers(store.offers, offer).sort(
    (a, b) => a.price - b.price || a.deliveryDays - b.deliveryDays,
  );
}

export function formatTelegramAnswer(
  store: StoreSnapshot,
  hits: ReturnType<typeof searchOffers>,
  query: string,
) {
  if (hits.length === 0) {
    return `SadParts Prices\n\nПо запросу «${query}» в прайсе ничего нет.`;
  }
  const names = new Map(store.suppliers.map((supplier: Supplier) => [supplier.id, supplier.name]));
  const first = hits[0].offer;
  const related = offersForPart(store, first);
  const oems = offerOems(first);
  const lines = [
    "SadParts Prices",
    "",
    `${first.brand} · ${first.sku}`,
    offerTitle(first),
    oems.length ? `OEM ${oems.join(" / ")}` : "",
    "",
    ...related.slice(0, 8).map((offer) => {
      const supplier = names.get(offer.supplierId) ?? "поставщик";
      const days = offer.deliveryDays ? `, ${offer.deliveryDays} дн. до Москвы` : "";
      return `${supplier} — ${formatMoney(offer.price, offer.currency)}, ${formatStock(offer.stock)}${days}${offer.warehouse ? ` (${offer.warehouse})` : ""}`;
    }),
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");
  if (hits.length > 1 && related.length <= 1) {
    lines.push("", "Ещё совпадения:");
    hits.slice(1, 5).forEach((hit) => {
      lines.push(
        `${hit.offer.brand} ${hit.offer.sku} · ${hit.supplierName} · ${formatMoney(hit.offer.price, hit.offer.currency)}`,
      );
    });
  }
  return lines.join("\n");
}

export function formatSuppliers(store: StoreSnapshot) {
  if (store.suppliers.length === 0) return "Поставщики ещё не добавлены.";
  const lines = ["SadParts Prices — поставщики", ""];
  store.suppliers.forEach((supplier) => {
    const count = store.offers.filter((offer) => offer.supplierId === supplier.id).length;
    const days = supplier.deliveryDaysMoscow ? `, ${supplier.deliveryDaysMoscow} дн. до Москвы` : "";
    lines.push(`${supplier.name}: ${count} поз.${days}`);
  });
  return lines.join("\n");
}

export const TELEGRAM_HELP = [
  "SadParts Prices",
  "",
  "Пришлите артикул, OEM или название — отвечу ценами, кроссами и сроком до Москвы.",
  "",
  "/search колодки — поиск",
  "/suppliers — список поставщиков",
  "/help — эта памятка",
].join("\n");
