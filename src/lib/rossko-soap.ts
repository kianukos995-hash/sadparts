import { XMLParser } from "fast-xml-parser";
import { ROSSKO_API_BASE } from "@/lib/constants";

const NS = "https://api.rossko.ru/";
const TIMEOUT_MS = 25_000;

const LIST_TAGS = new Set([
  "Part",
  "part",
  "delivery",
  "payment",
  "address",
  "company",
  "Item",
  "ItemError",
  "Order",
  "Wave",
]);

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => LIST_TAGS.has(name),
});

export const ROSSKO_SOAP_ACTIONS = [
  "GetSearch",
  "GetCheckoutDetails",
  "GetCheckout",
  "GetOrders",
  "GetDeliveryDetails",
  "GetSettlements",
  "GetBrokenWave",
] as const;

export type RosskoSoapAction = (typeof ROSSKO_SOAP_ACTIONS)[number];

export interface RosskoStock {
  id: string;
  price: number;
  count: number;
  multiplicity: number;
  type: number;
  delivery: number;
  extra?: number;
  description?: string;
  deliveryStart?: string;
  deliveryEnd?: string;
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
  deliveryIds: string[];
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
  deliveryCosts: string[];
  items: {
    partnumber: string;
    brand: string;
    count: number;
    price?: number;
    totalPrice?: number;
    stock?: string;
    delivery?: number;
    deliveryStart?: string;
    deliveryEnd?: string;
    comment?: string;
    orderId?: string;
    extra?: number;
    description?: string;
    stockAddress?: string;
  }[];
  errors: { partnumber: string; brand: string; count: number; stock?: string; message: string }[];
}

export interface RosskoOrder {
  id: string;
  createdDate: string;
  deliveryDate: string;
  totalPrice: string;
  paymentStatus: string;
  extra?: number;
  stockAddress: string;
  deliveryType: string;
  deliveryCost?: string;
  deliveryAddress?: string;
  paymentType?: string;
  companyName?: string;
  companyRequisites?: string;
  comment?: string;
  parts: {
    guid: string;
    partnumber: string;
    name: string;
    brand: string;
    price: string;
    count: number;
    delivery: number;
    comment?: string;
    status?: number;
  }[];
}

export interface RosskoDeliveryWave {
  id: string;
  name: string;
  waves: { deliveryStart: string; deliveryEnd: string; timeLimit: string }[];
}

export function isRosskoSoapXml(text: string) {
  const sample = text.slice(0, 4000);
  return (
    /<(?:\w+:)?(?:Envelope|GetSearch|GetSearchResponse|SearchResult|GetCheckout|GetCheckoutDetails|GetOrders|PartsList)\b/i.test(
      sample,
    ) && /(?:rossko|Part|partnumber|KEY1)/i.test(sample)
  );
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
  if (typeof value === "boolean") return `<ns:${name}>${value ? "true" : "false"}</ns:${name}>`;
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

export function asArray<T>(value: T | T[] | undefined | null): T[] {
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

function str(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function bool(value: unknown) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").toLowerCase();
  return text === "true" || text === "1";
}

export function parseSoapXml(xml: string): unknown {
  return parser.parse(xml) as unknown;
}

export function parsePart(raw: unknown): RosskoPart {
  const row = asRecord(raw) ?? {};
  const stockNode = deepFind(row.stocks ?? row.StocksList ?? row, ["stock", "Stock"]);
  const stocks = asArray(stockNode).map((item) => {
    const stock = asRecord(item) ?? {};
    return {
      id: str(stock.id ?? stock.StockID),
      price: num(stock.price ?? stock.Price),
      count: Math.round(num(stock.count ?? stock.Count)),
      multiplicity: Math.max(1, Math.round(num(stock.multiplicity) || 1)),
      type: Math.round(num(stock.type)),
      delivery: Math.round(num(stock.delivery ?? stock.DeliveryTime)),
      extra: Math.round(num(stock.extra)),
      description: str(stock.description ?? stock.StockID),
      deliveryStart: str(stock.deliveryStart) || undefined,
      deliveryEnd: str(stock.deliveryEnd) || undefined,
    };
  });
  const crosses = asArray(deepFind(row.crosses ?? row.CrossesList, ["Part", "part"])).map(parsePart);
  return {
    guid: str(row.guid ?? row.GUID),
    brand: str(row.brand ?? row.Brand),
    partnumber: str(row.partnumber ?? row.PartNumber),
    name: str(row.name ?? row.Name),
    stocks,
    crosses,
  };
}

function resultShell(raw: unknown, names: string[], fallback: string) {
  const record = asRecord(deepFind(raw, names) ?? raw);
  const success = bool(record?.success ?? record?.Success);
  const message = str(record?.message ?? record?.Message);
  return { success, message: message || (success ? "" : fallback), record };
}

export function parseSearchResult(raw: unknown): RosskoSearchResult {
  const { success, message, record } = resultShell(raw, ["SearchResult"], "Ничего не найдено");
  const parts = asArray(deepFind(record?.PartsList ?? record, ["Part"])).map(parsePart);
  return { success, text: str(record?.text), message, parts };
}

export function parseCheckoutDetails(raw: unknown): RosskoCheckoutDetails {
  const { success, message, record } = resultShell(
    raw,
    ["CheckoutDetailsResult"],
    "Не удалось получить способы доставки",
  );
  const deliveries = asArray(deepFind(record?.DeliveryType, ["delivery"])).map((item) => {
    const row = asRecord(item) ?? {};
    return { id: str(row.id), name: str(row.name) };
  });
  const payments = asArray(deepFind(record?.PaymentType, ["payment"])).map((item) => {
    const row = asRecord(item) ?? {};
    return { id: Math.round(num(row.id)), name: str(row.name) };
  });
  const addresses = asArray(deepFind(record?.DeliveryAddress, ["address"])).map((item) => {
    const row = asRecord(item) ?? {};
    const deliveryNode = asRecord(row.Delivery) ?? asRecord(row.delivery) ?? {};
    const ids = asArray(deepFind(deliveryNode.ids ?? deliveryNode, ["id"])).map((id) =>
      str(asRecord(id)?.id ?? id),
    );
    return {
      id: Math.round(num(row.id)),
      city: str(row.city),
      street: str(row.street),
      house: str(row.house),
      office: str(row.office),
      deliveryIds: ids.filter(Boolean),
    };
  });
  const companies = asArray(deepFind(record?.CompanyList, ["company"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      id: Math.round(num(row.id)) || undefined,
      name: str(row.name),
      requisites: str(row.requisite ?? row.requisites ?? row.Requisites),
    };
  });
  return { success, message, deliveries, payments, addresses, companies };
}

export function parseCheckoutResult(raw: unknown): RosskoCheckoutResult {
  const { success, message, record } = resultShell(raw, ["CheckoutResult"], "Заказ не оформлен");
  const orderIds = asArray(deepFind(record?.OrderIDS ?? record?.OrderID, ["id", "OrderID"]))
    .map((item) => str(asRecord(item)?.id ?? item))
    .filter(Boolean);
  if (record?.OrderID && orderIds.length === 0) orderIds.push(str(record.OrderID));
  const deliveryCosts = asArray(deepFind(record?.DeliveryCost, ["cost"])).map((item) =>
    str(asRecord(item)?.cost ?? item),
  );
  const items = asArray(deepFind(record?.ItemsList, ["Item"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      partnumber: str(row.partnumber ?? row.PART_NUMBER),
      brand: str(row.brand ?? row.BRAND),
      count: Math.round(num(row.count ?? row.COUNT)),
      price: num(row.price),
      totalPrice: num(row.total_price),
      stock: str(row.stock),
      delivery: Math.round(num(row.delivery ?? row.DELIVERY_TIME)),
      deliveryStart: str(row.deliveryStart) || undefined,
      deliveryEnd: str(row.deliveryEnd) || undefined,
      comment: str(row.comment) || undefined,
      orderId: str(row.order_id),
      extra: Math.round(num(row.extra)),
      description: str(row.description) || undefined,
      stockAddress: str(row.stock_address) || undefined,
    };
  });
  const errors = asArray(deepFind(record?.ItemsErrorList, ["ItemError"])).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      partnumber: str(row.partnumber ?? row.PART_NUMBER),
      brand: str(row.brand ?? row.BRAND),
      count: Math.round(num(row.count ?? row.COUNT)),
      stock: str(row.stock),
      message: str(row.message ?? row.MESSAGE) || "не заказан",
    };
  });
  return { success, message, orderIds, deliveryCosts, items, errors };
}

export function parseOrdersResult(raw: unknown) {
  const { success, message, record } = resultShell(raw, ["OrdersResult"], "Заказы не найдены");
  const orders: RosskoOrder[] = asArray(deepFind(record?.OrdersList, ["Order"])).map((item) => {
    const row = asRecord(item) ?? {};
    const detail = asRecord(row.detail ?? row.Details) ?? {};
    return {
      id: str(row.id ?? row.ID),
      createdDate: str(row.created_date ?? row.DateCreated),
      deliveryDate: str(row.delivery_date ?? row.DateDelivery),
      totalPrice: str(row.total_price ?? row.Sum),
      paymentStatus: str(row.payment_status ?? row.StatusPayment ?? detail.payment_type),
      extra: Math.round(num(row.extra)),
      stockAddress: str(row.stock_address),
      deliveryType: str(detail.delivery_type ?? detail.TypeDelivery),
      deliveryCost: str(detail.delivery_cost) || undefined,
      deliveryAddress: str(detail.delivery_address) || undefined,
      paymentType: str(detail.payment_type) || undefined,
      companyName: str(detail.company_name) || undefined,
      companyRequisites: str(detail.company_requisites) || undefined,
      comment: str(detail.comment ?? row.comment) || undefined,
      parts: asArray(deepFind(row.parts ?? row.Parts, ["part", "Part"])).map((part) => {
        const line = asRecord(part) ?? {};
        return {
          guid: str(line.guid ?? line.GUID),
          partnumber: str(line.partnumber ?? line.PartNumber),
          name: str(line.name ?? line.Name),
          brand: str(line.brand ?? line.Brand),
          price: str(line.price ?? line.Price),
          count: Math.round(num(line.count ?? line.Count)),
          delivery: Math.round(num(line.delivery ?? line.DeliveryTime)),
          comment: str(line.comment) || undefined,
          status: Math.round(num(line.status)),
        };
      }),
    };
  });
  return { success, message, orders };
}

export function parseDeliveryDetails(raw: unknown) {
  const { success, message, record } = resultShell(
    raw,
    ["DeliveryDetailsResult", "SearchResult"],
    "Нет волн доставки",
  );
  const deliveries: RosskoDeliveryWave[] = asArray(
    deepFind(record?.Deliveries ?? record, ["Delivery"]),
  ).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      id: str(row.id),
      name: str(row.name),
      waves: asArray(deepFind(row, ["Wave"])).map((wave) => {
        const node = asRecord(wave) ?? {};
        return {
          deliveryStart: str(node.deliveryStart),
          deliveryEnd: str(node.deliveryEnd),
          timeLimit: str(node.timeLimit),
        };
      }),
    };
  });
  return { success, message, deliveries };
}

export function parseSettlements(raw: unknown) {
  const { success, message, record } = resultShell(raw, ["SettlementsResult"], "Нет взаиморасчётов");
  const info = asRecord(record?.Info) ?? {};
  return {
    success,
    message,
    info: {
      balance: str(info.balance),
      limit: str(info.limit),
      type: str(info.type),
      currency: str(info.currency),
      paymentDelay: Math.round(num(info.paymentDelay)),
    },
    raw: record,
  };
}

export function parseBrokenWave(raw: unknown) {
  const { success, message, record } = resultShell(raw, ["BrokenWaveResult"], "Нет заблокированных волн");
  const waves = asArray(deepFind(record?.brokenWaves ?? record, ["Wave"])).map((item) => {
    const row = asRecord(item) ?? {};
    const point = asRecord(row.delivery_point) ?? {};
    const info = asRecord(row.info) ?? {};
    return {
      pointId: Math.round(num(point.id)),
      address: str(point.address),
      guid: str(info.guid),
      days: asArray(deepFind(info.days, ["day"])).map((day) => str(asRecord(day)?.day ?? day)),
      from: str(info.from),
      to: str(info.to),
    };
  });
  return { success, message, waves };
}

export function rosskoSoapXmlToParts(xml: string): RosskoPart[] {
  return parseSearchResult(parseSoapXml(xml)).parts;
}

export function flattenRosskoParts(parts: RosskoPart[]) {
  const rows: Record<string, string>[] = [];
  for (const part of parts) {
    const stocks = part.stocks.length
      ? part.stocks
      : [{ id: "", price: 0, count: 0, multiplicity: 1, type: 0, delivery: 0 }];
    for (const stock of stocks) {
      rows.push({
        guid: part.guid,
        Номенклатура: part.guid,
        brand: part.brand,
        Бренд: part.brand,
        partnumber: part.partnumber,
        Артикул: part.partnumber,
        name: part.name,
        Описание: part.name,
        stock: stock.id,
        id: stock.id,
        price: String(stock.price),
        "Цена, руб.": String(stock.price),
        count: String(stock.count),
        Наличие: String(stock.count),
        multiplicity: String(stock.multiplicity),
        "Кратность отгрузки": String(stock.multiplicity),
        type: String(stock.type),
        delivery: String(stock.delivery),
        "Срок поставки, дн.": String(stock.delivery),
        extra: String(stock.extra ?? 0),
        description: stock.description ?? "",
        deliveryStart: stock.deliveryStart ?? "",
        deliveryEnd: stock.deliveryEnd ?? "",
        crosses: part.crosses.map((item) => item.partnumber).join(";"),
      });
    }
  }
  return rows;
}

function endpoint(base: string, action: string) {
  const root = (base || ROSSKO_API_BASE).replace(/\/+$/, "").replace(/\/Get\w+$/, "");
  return `${root}/${action}`;
}

export async function rosskoSoap(action: RosskoSoapAction, inner: string, baseUrl = ROSSKO_API_BASE) {
  const url = endpoint(baseUrl, action);
  const body = envelope(action, inner);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"https://api.rossko.ru/service/v2.1/${action}"`,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Росско ${action} ответил ${response.status}`);
    }
    return parseSoapXml(text);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Росско не ответил вовремя");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
    addressId ? tag("address_id", Number.parseInt(addressId, 10) || addressId) : "",
  ].join("");
  return parseSearchResult(await rosskoSoap("GetSearch", inner, baseUrl));
}

export async function rosskoGetCheckoutDetails(
  key1: string,
  key2: string,
  baseUrl?: string,
): Promise<RosskoCheckoutDetails> {
  return parseCheckoutDetails(
    await rosskoSoap("GetCheckoutDetails", `${tag("KEY1", key1)}${tag("KEY2", key2)}`, baseUrl),
  );
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
  const addressId = input.addressId ? Number.parseInt(input.addressId, 10) || input.addressId : undefined;
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    `<ns:delivery>${tag("delivery_id", input.deliveryId)}${addressId !== undefined ? tag("address_id", addressId) : ""}</ns:delivery>`,
    `<ns:payment>${tag("payment_id", input.paymentId)}${input.requisiteId ? tag("requisite_id", input.requisiteId) : ""}</ns:payment>`,
    `<ns:contact>${tag("name", input.contactName)}${tag("phone", input.contactPhone)}${tag("comment", input.comment)}</ns:contact>`,
    tag("delivery_parts", input.deliveryParts),
    `<ns:PARTS>${partsXml}</ns:PARTS>`,
  ].join("");
  return parseCheckoutResult(await rosskoSoap("GetCheckout", inner, baseUrl));
}

export async function rosskoGetOrders(
  key1: string,
  key2: string,
  orderIds: string[] = [],
  limit = 20,
  baseUrl?: string,
  extra?: { type?: number; startDate?: string; endDate?: string },
) {
  const idsXml = orderIds.map((id) => tag("id", Number.parseInt(id, 10) || id)).join("");
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    idsXml ? `<ns:order_ids>${idsXml}</ns:order_ids>` : "",
    orderIds.length ? "" : tag("limit", Math.min(500, Math.max(1, limit))),
    extra?.type ? tag("type", extra.type) : "",
    extra?.startDate ? tag("start_date", extra.startDate) : "",
    extra?.endDate ? tag("end_date", extra.endDate) : "",
  ].join("");
  return parseOrdersResult(await rosskoSoap("GetOrders", inner, baseUrl));
}

export async function rosskoGetDeliveryDetails(
  key1: string,
  key2: string,
  date: string,
  addressId: string,
  baseUrl?: string,
) {
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    tag("date", date),
    tag("address_id", Number.parseInt(addressId, 10) || addressId),
  ].join("");
  return parseDeliveryDetails(await rosskoSoap("GetDeliveryDetails", inner, baseUrl));
}

export async function rosskoGetSettlements(key1: string, key2: string, baseUrl?: string) {
  return parseSettlements(await rosskoSoap("GetSettlements", `${tag("KEY1", key1)}${tag("KEY2", key2)}`, baseUrl));
}

export async function rosskoGetBrokenWave(
  key1: string,
  key2: string,
  guidList: string[] = [],
  baseUrl?: string,
) {
  const guids = guidList.map((id) => tag("guid", id)).join("");
  const inner = [
    tag("KEY1", key1),
    tag("KEY2", key2),
    guids ? `<ns:guid_list>${guids}</ns:guid_list>` : "",
  ].join("");
  return parseBrokenWave(await rosskoSoap("GetBrokenWave", inner, baseUrl));
}

export function checkoutPartnumber(sku: string, vendor?: string) {
  const article = sku.trim();
  const code = (vendor ?? "").trim();
  if (!code || article.includes("@") || article.toUpperCase() === code.toUpperCase()) return article;
  return `${article}@${code}`;
}
