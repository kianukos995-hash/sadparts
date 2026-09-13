import { XMLParser } from "fast-xml-parser";
import { ROSSKO_API_BASE } from "@/lib/constants";

const NS = "https://api.rossko.ru/";
const TIMEOUT_MS = 25_000;

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
});

export interface RosskoStock {
  id: string;
  price: number;
  count: number;
  multiplicity: number;
  delivery: number;
  extra?: number;
  description?: string;
}

export interface RosskoPart {
  guid: string;
  brand: string;
  partnumber: string;
  name: string;
  stocks: RosskoStock[];
  crosses: RosskoPart[];
}

export interface RosskoSearchResult {
  success: boolean;
  text?: string;
  message?: string;
  parts: RosskoPart[];
}

export interface RosskoDelivery {
  id: string;
  name: string;
}

export interface RosskoPayment {
  id: number;
  name: string;
}

export interface RosskoAddress {
  id: number;
  city: string;
  street: string;
  house: string;
  office: string;
}

export interface RosskoCompany {
  id?: number;
  name: string;
  requisites?: string;
}

export interface RosskoCheckoutDetails {
  success: boolean;
  message?: string;
  deliveries: RosskoDelivery[];
  payments: RosskoPayment[];
  addresses: RosskoAddress[];
  companies: RosskoCompany[];
}

export interface RosskoCheckoutPart {
  partnumber: string;
  brand: string;
  stock: string;
  count: number;
  comment?: string;
}

export interface RosskoCheckoutInput {
  deliveryId: string;
  addressId?: string;
  paymentId: number;
  requisiteId?: number;
  contactName: string;
  contactPhone: string;
  comment?: string;
  deliveryParts: boolean;
  parts: RosskoCheckoutPart[];
}

export interface RosskoCheckoutResult {
  success: boolean;
  message?: string;
  orderIds: string[];
  items: { partnumber: string; brand: string; count: number; price?: number; stock?: string; delivery?: number; orderId?: string }[];
  errors: { partnumber: string; brand: string; count: number; message: string }[];
}

export interface RosskoOrder {
  id: string;
  createdDate: string;
  deliveryDate: string;
  totalPrice: string;
  paymentStatus: string;
  stockAddress: string;
  deliveryType: string;
  parts: { guid: string; partnumber: string; name: string; brand: string; price: string; count: number; delivery: number; status?: number }[];
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tag(name: string, value: string | number | boolean | undefined) {
  if (value === undefined || value === "") return "";
  return `<ns:${name}>${xmlEscape(String(value))}</ns:${name}>`;
}

function envelope(action: string, inner: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS}">
  <soap:Body>
    <ns:${action}>${inner}</ns:${action}>
  </soap:Body>
</soap:Envelope>`;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function deepFind(value: unknown, names: string[]): unknown {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const name of names) {
    if (name in record) return record[name];
  }
  for (const child of Object.values(record)) {
    const found = deepFind(child, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function num(value: unknown) {
  const n = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parsePart(raw: unknown): RosskoPart {
  const row = asRecord(raw) ?? {};
  const stocks = asArray(deepFind(row.stocks ?? row.StocksList, ["stock", "Stock"]) ?? row.stocks).map((item) => {
    const stock = asRecord(item) ?? {};
    return {
      id: String(stock.id ?? stock.StockID ?? ""),
      price: num(stock.price ?? stock.Price),
      count: Math.round(num(stock.count ?? stock.Count)),
      multiplicity: Math.max(1, Math.round(num(stock.multiplicity) || 1)),
      delivery: Math.round(num(stock.delivery ?? stock.DeliveryTime)),
      extra: Math.round(num(stock.extra)),
      description: String(stock.description ?? stock.StockID ?? ""),
    };
  });
  const crosses = asArray(
    deepFind(row.crosses ?? row.CrossesList, ["Part", "part"]) ?? row.crosses,
  ).map(parsePart);
  return {
    guid: String(row.guid ?? row.GUID ?? ""),
    brand: String(row.brand ?? row.Brand ?? ""),
    partnumber: String(row.partnumber ?? row.PartNumber ?? ""),
    name: String(row.name ?? row.Name ?? ""),
    stocks,
    crosses,
  };
}

function endpoint(base: string, action: string) {
  const root = (base || ROSSKO_API_BASE).replace(/\/+$/, "").replace(/\/Get\w+$/, "");
  return `${root}/${action}`;
}

export async function rosskoSoap(action: string, inner: string, baseUrl = ROSSKO_API_BASE) {
  const url = endpoint(baseUrl, action);
  const body = envelope(action, inner);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${url}"`,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Росско ${action} ответил ${response.status}`);
    }
    return parser.parse(text) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Росско не ответил вовремя");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function resultMessage(raw: unknown, fallback: string) {
  const record = asRecord(deepFind(raw, ["SearchResult", "CheckoutDetailsResult", "CheckoutResult", "OrdersResult"]) ?? raw);
  const success = String(record?.success ?? record?.Success ?? "") === "true" || record?.success === true;
  const message = String(record?.message ?? record?.Message ?? "");
  return { success, message: message || (success ? "" : fallback), record };
}

export async function rosskoGetSearch(
  key1: string,
  key2: string,
  text: string,
  deliveryId: string,
  addressId?: string,
  baseUrl?: string,
): Promise<RosskoSearchResult> {
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    tag("text", text),
    tag("delivery_id", deliveryId),
    addressId ? tag("address_id", addressId) : "",
  ].join("");
  const parsed = await rosskoSoap("GetSearch", inner, baseUrl);
  const { success, message, record } = resultMessage(parsed, "Ничего не найдено");
  const parts = asArray(deepFind(record?.PartsList ?? record, ["Part"])).map(parsePart);
  return { success, text: String(record?.text ?? text), message, parts };
}

export async function rosskoGetCheckoutDetails(
  key1: string,
  key2: string,
  baseUrl?: string,
): Promise<RosskoCheckoutDetails> {
  const parsed = await rosskoSoap("GetCheckoutDetails", `${tag("KEY1", key1)}${tag("KEY2", key2)}`, baseUrl);
  const { success, message, record } = resultMessage(parsed, "Не удалось получить способы доставки");
  const deliveries = asArray(deepFind(record?.DeliveryType, ["delivery"])).map((item) => {
    const row = asRecord(item) ?? {};
    return { id: String(row.id ?? ""), name: String(row.name ?? "") };
  });
  const payments = asArray(deepFind(record?.PaymentType, ["payment"])).map((item) => {
    const row = asRecord(item) ?? {};
    return { id: Number(row.id) || 0, name: String(row.name ?? "") };
  });
  const addresses = asArray(deepFind(record?.DeliveryAddress, ["address"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      id: Number(row.id) || 0,
      city: String(row.city ?? ""),
      street: String(row.street ?? ""),
      house: String(row.house ?? row.house ?? ""),
      office: String(row.office ?? ""),
    };
  });
  const companies = asArray(deepFind(record?.CompanyList, ["company"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      id: Number(row.id) || undefined,
      name: String(row.name ?? ""),
      requisites: String(row.requisites ?? row.Requisites ?? ""),
    };
  });
  return { success, message, deliveries, payments, addresses, companies };
}

export async function rosskoGetCheckout(
  key1: string,
  key2: string,
  input: RosskoCheckoutInput,
  baseUrl?: string,
): Promise<RosskoCheckoutResult> {
  const partsXml = input.parts
    .map(
      (part) =>
        `<ns:Part>${tag("partnumber", part.partnumber)}${tag("brand", part.brand)}${tag("stock", part.stock)}${tag("count", part.count)}${tag("comment", part.comment)}</ns:Part>`,
    )
    .join("");
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    `<ns:delivery>${tag("delivery_id", input.deliveryId)}${input.addressId ? tag("address_id", input.addressId) : ""}</ns:delivery>`,
    `<ns:payment>${tag("payment_id", input.paymentId)}${input.requisiteId ? tag("requisite_id", input.requisiteId) : ""}</ns:payment>`,
    `<ns:contact>${tag("name", input.contactName)}${tag("phone", input.contactPhone)}${tag("comment", input.comment)}</ns:contact>`,
    tag("delivery_parts", input.deliveryParts),
    `<ns:PARTS>${partsXml}</ns:PARTS>`,
  ].join("");
  const parsed = await rosskoSoap("GetCheckout", inner, baseUrl);
  const { success, message, record } = resultMessage(parsed, "Заказ не оформлен");
  const orderIds = asArray(deepFind(record?.OrderIDS ?? record?.OrderID, ["id", "OrderID"]))
    .map((item) => String(asRecord(item)?.id ?? item ?? ""))
    .filter(Boolean);
  if (record?.OrderID && orderIds.length === 0) orderIds.push(String(record.OrderID));
  const items = asArray(deepFind(record?.ItemsList, ["Item"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      partnumber: String(row.partnumber ?? row.PART_NUMBER ?? ""),
      brand: String(row.brand ?? row.BRAND ?? ""),
      count: Math.round(num(row.count ?? row.COUNT)),
      price: num(row.price),
      stock: String(row.stock ?? ""),
      delivery: Math.round(num(row.delivery ?? row.DELIVERY_TIME)),
      orderId: String(row.order_id ?? ""),
    };
  });
  const errors = asArray(deepFind(record?.ItemsErrorList, ["ItemError"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      partnumber: String(row.partnumber ?? row.PART_NUMBER ?? ""),
      brand: String(row.brand ?? row.BRAND ?? ""),
      count: Math.round(num(row.count ?? row.COUNT)),
      message: String(row.message ?? row.MESSAGE ?? "не заказан"),
    };
  });
  return { success, message, orderIds, items, errors };
}

export async function rosskoGetOrders(
  key1: string,
  key2: string,
  orderIds: string[] = [],
  limit = 20,
  baseUrl?: string,
) {
  const idsXml = orderIds.map((id) => tag("id", id)).join("");
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    idsXml ? `<ns:order_ids>${idsXml}</ns:order_ids>` : "",
    orderIds.length ? "" : tag("limit", limit),
  ].join("");
  const parsed = await rosskoSoap("GetOrders", inner, baseUrl);
  const { success, message, record } = resultMessage(parsed, "Заказы не найдены");
  const orders: RosskoOrder[] = asArray(deepFind(record?.OrdersList, ["Order"])).map((item) => {
    const row = asRecord(item) ?? {};
    const detail = asRecord(row.detail ?? row.Details) ?? {};
    return {
      id: String(row.id ?? row.ID ?? ""),
      createdDate: String(row.created_date ?? row.DateCreated ?? ""),
      deliveryDate: String(row.delivery_date ?? row.DateDelivery ?? ""),
      totalPrice: String(row.total_price ?? row.Sum ?? ""),
      paymentStatus: String(row.payment_status ?? row.StatusPayment ?? ""),
      stockAddress: String(row.stock_address ?? ""),
      deliveryType: String(detail.delivery_type ?? detail.TypeDelivery ?? ""),
      parts: asArray(deepFind(row.parts ?? row.Parts, ["part", "Part"])).map((part) => {
        const line = asRecord(part) ?? {};
        return {
          guid: String(line.guid ?? line.GUID ?? ""),
          partnumber: String(line.partnumber ?? line.PartNumber ?? ""),
          name: String(line.name ?? line.Name ?? ""),
          brand: String(line.brand ?? line.Brand ?? ""),
          price: String(line.price ?? line.Price ?? ""),
          count: Math.round(num(line.count ?? line.Count)),
          delivery: Math.round(num(line.delivery ?? line.DeliveryTime)),
          status: Math.round(num(line.status)),
        };
      }),
    };
  });
  return { success, message, orders };
}
