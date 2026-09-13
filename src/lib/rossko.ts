import { DEMO_KEYS, ROSSKO_API_BASE } from "@/lib/constants";
import { offerKey, normalizeSku } from "@/lib/format";
import { mergeCrosses } from "@/lib/cross-catalog";
import { searchCatalog } from "@/lib/file-catalog";
import {
  rosskoGetCheckout,
  rosskoGetCheckoutDetails,
  rosskoGetOrders,
  rosskoGetSearch,
  type RosskoCheckoutInput,
  type RosskoCheckoutDetails,
  type RosskoPart,
} from "@/lib/rossko-soap";
import { CORE_PARTS, partPrice, partStock } from "@/lib/mock-parts";
import type { Offer, Order, OrderLine, Supplier } from "@/lib/types";

export function isRosskoSupplier(supplier: Supplier) {
  return (
    supplier.adapter === "rossko" ||
    supplier.code === "ROSSKO" ||
    supplier.demoSlug === "rossko" ||
    supplier.name.toLowerCase().includes("росс")
  );
}

export function isRosskoDemo(supplier: Supplier) {
  return supplier.apiKey === DEMO_KEYS.rossko || supplier.apiKey2 === DEMO_KEYS.rossko2;
}

function keys(supplier: Supplier) {
  const key1 = supplier.apiKey.trim();
  const key2 = supplier.apiKey2.trim();
  if (!key1 || !key2) {
    throw new Error("Для Росско нужны оба ключа: KEY1 и KEY2 из личного кабинета.");
  }
  return { key1, key2, base: supplier.apiUrl || ROSSKO_API_BASE };
}

function mockDetails(): RosskoCheckoutDetails {
  return {
    success: true,
    deliveries: [
      { id: "000000001", name: "Самовывоз (демо)" },
      { id: "000000002", name: "Курьер по Москве (демо)" },
    ],
    payments: [
      { id: 1, name: "Безналичный расчёт" },
      { id: 2, name: "Карта" },
    ],
    addresses: [{ id: 1, city: "Москва", street: "Склад Подольск", house: "1", office: "" }],
    companies: [{ id: 1, name: "Демо-организация", requisites: "ИНН 0000000000" }],
  };
}

function mockParts(query: string): RosskoPart[] {
  const q = query.trim().toLowerCase();
  const qSku = normalizeSku(query);
  return CORE_PARTS.filter((part) => {
    return (
      normalizeSku(part.sku).includes(qSku) ||
      normalizeSku(part.oem).includes(qSku) ||
      part.brand.toLowerCase().includes(q) ||
      part.name.toLowerCase().includes(q)
    );
  }).slice(0, 20).map((part, index) => ({
    guid: `NSIN${String(1000000000 + index)}`,
    brand: part.brand,
    partnumber: part.sku.replace(/\s+/g, "").toUpperCase(),
    name: part.name,
    stocks: [
      {
        id: "HST-MSK",
        price: partPrice(part.basePrice, 1),
        count: partStock(index + 1),
        multiplicity: 1,
        delivery: 1,
        description: "МСК-Юг",
      },
    ],
    crosses: [],
  }));
}

export function rosskoPartsToOffers(supplier: Supplier, parts: RosskoPart[]): Offer[] {
  const now = new Date().toISOString();
  const offers: Offer[] = [];
  for (const part of parts) {
    const sku = normalizeSku(part.partnumber);
    const crosses = mergeCrosses(
      "",
      part.crosses.map((item) => item.partnumber),
    );
    const stocks = part.stocks.length ? part.stocks : [
      { id: "", price: 0, count: 0, multiplicity: 1, delivery: supplier.deliveryDaysMoscow || 1, description: "" },
    ];
    for (const stock of stocks) {
      offers.push({
        id: offerKey(supplier.id, part.guid || sku, stock.id),
        supplierId: supplier.id,
        sku,
        brand: part.brand || "—",
        name: part.name || sku,
        displayName: "",
        oem: normalizeSku(part.guid.startsWith("NS") ? "" : part.guid) || sku,
        crossOems: crosses,
        category: "Расходники",
        price: stock.price,
        currency: "RUB",
        stock: stock.count,
        warehouse: stock.description || stock.id || "Росско",
        multiplicity: stock.multiplicity || 1,
        deliveryDays: stock.delivery || supplier.deliveryDaysMoscow || 1,
        guid: part.guid,
        stockId: stock.id,
        updatedAt: now,
        source: "api",
      });
    }
  }
  return offers;
}

export async function rosskoDetails(supplier: Supplier) {
  if (isRosskoDemo(supplier) && supplier.apiKey === DEMO_KEYS.rossko) {
    return mockDetails();
  }
  const { key1, key2, base } = keys(supplier);
  return rosskoGetCheckoutDetails(key1, key2, base);
}

export async function ensureRosskoDelivery(supplier: Supplier) {
  if (supplier.rosskoDeliveryId) return supplier;
  const details = await rosskoDetails(supplier);
  if (!details.success) throw new Error(details.message || "GetCheckoutDetails не удался");
  const pickup =
    details.deliveries.find((item) => /самовывоз|pickup/i.test(item.name)) ?? details.deliveries[0];
  if (!pickup) throw new Error("В кабинете Росско нет способов доставки");
  return {
    ...supplier,
    rosskoDeliveryId: pickup.id,
    rosskoAddressId: supplier.rosskoAddressId || (details.addresses[0] ? String(details.addresses[0].id) : ""),
  };
}

export async function rosskoSearch(supplier: Supplier, query: string): Promise<{ offers: Offer[]; message?: string; live: boolean }> {
  const fileHits = await searchCatalog(supplier, query, 80);
  if (isRosskoDemo(supplier) && supplier.apiKey === DEMO_KEYS.rossko) {
    const demo = rosskoPartsToOffers(supplier, mockParts(query));
    const merged = mergeOffers([...demo, ...fileHits]);
    return { offers: merged, live: false, message: merged.length ? undefined : "В демо-каталоге нет совпадений" };
  }
  try {
    const ready = await ensureRosskoDelivery(supplier);
    const { key1, key2, base } = keys(ready);
    const result = await rosskoGetSearch(
      key1,
      key2,
      query,
      ready.rosskoDeliveryId || "000000001",
      ready.rosskoAddressId || undefined,
      base,
    );
    const live = rosskoPartsToOffers(ready, result.parts);
    return {
      offers: mergeOffers([...live, ...fileHits]),
      live: true,
      message: result.success ? undefined : result.message,
    };
  } catch (error) {
    return {
      offers: fileHits,
      live: false,
      message: error instanceof Error ? error.message : "GetSearch недоступен, показан прайс с диска",
    };
  }
}

function mergeOffers(offers: Offer[]) {
  const map = new Map<string, Offer>();
  for (const offer of offers) {
    const current = map.get(offer.id);
    if (!current || (offer.source === "api" && current.source !== "api")) map.set(offer.id, offer);
    else if (!current) map.set(offer.id, offer);
  }
  return Array.from(map.values()).sort((a, b) => a.price - b.price || a.deliveryDays - b.deliveryDays);
}

export async function rosskoCheckout(supplier: Supplier, input: RosskoCheckoutInput) {
  if (isRosskoDemo(supplier) && supplier.apiKey === DEMO_KEYS.rossko) {
    return {
      success: true,
      message: "Демо-заказ Росско (реальный GetCheckout не вызывался)",
      orderIds: [`DEMO-${Date.now().toString().slice(-6)}`],
      items: input.parts.map((part) => ({
        partnumber: part.partnumber,
        brand: part.brand,
        count: part.count,
        stock: part.stock,
      })),
      errors: [] as { partnumber: string; brand: string; count: number; message: string }[],
    };
  }
  const ready = await ensureRosskoDelivery(supplier);
  const { key1, key2, base } = keys(ready);
  return rosskoGetCheckout(key1, key2, { ...input, deliveryId: input.deliveryId || ready.rosskoDeliveryId || "" }, base);
}

export async function rosskoOrders(supplier: Supplier, orderIds: string[] = []) {
  if (isRosskoDemo(supplier) && supplier.apiKey === DEMO_KEYS.rossko) {
    return { success: true, message: "", orders: [] };
  }
  const { key1, key2, base } = keys(supplier);
  return rosskoGetOrders(key1, key2, orderIds, 20, base);
}

export function orderLinesToRosskoParts(lines: OrderLine[]) {
  return lines.map((line) => ({
    partnumber: line.sku,
    brand: line.brand,
    stock: line.stockId || "",
    count: line.qty,
  }));
}

export function filterRosskoLines(order: Order, supplierId: string) {
  return order.lines.filter((line) => line.supplierId === supplierId);
}
