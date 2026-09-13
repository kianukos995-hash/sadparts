export type SupplierSource = "api" | "file" | "url" | "paste" | "manual";
export type ImportMode = "replace" | "merge";
export type AuthMode = "bearer" | "header" | "query";
export type AdapterKind = "generic" | "demo" | "rossko";
export type SyncStatus = "ok" | "error";
export type OrderStatus = "draft" | "assembled" | "sent";
export type PaymentMethod = "cash" | "card" | "cashless";
export type MoneyDirection = "income" | "expense";
export type BillPayStatus = "unpaid" | "partial" | "paid";

export const FIELD_KEYS = [
  "sku",
  "brand",
  "name",
  "oem",
  "category",
  "price",
  "currency",
  "stock",
  "warehouse",
  "multiplicity",
  "deliveryDays",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export type ColumnMap = Record<FieldKey, string>;

export interface Supplier {
  id: string;
  name: string;
  code: string;
  source: SupplierSource;
  adapter: AdapterKind;
  demoSlug?: string;
  apiUrl: string;
  apiKey: string;
  apiKey2: string;
  authMode: AuthMode;
  authHeaderName: string;
  authQueryParam: string;
  itemsPath: string;
  columnMap: ColumnMap;
  notes: string;
  active: boolean;
  createdAt: string;
  deliveryDaysMoscow: number;
  deliveryNote: string;
  lastSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  lastSyncError?: string;
  lastSyncCount?: number;
  catalogCount?: number;
  rosskoDeliveryId?: string;
  rosskoAddressId?: string;
}

export interface Offer {
  id: string;
  supplierId: string;
  sku: string;
  brand: string;
  name: string;
  displayName?: string;
  oem: string;
  crossOems: string[];
  category: string;
  price: number;
  currency: string;
  stock: number;
  warehouse: string;
  multiplicity: number;
  deliveryDays: number;
  guid?: string;
  stockId?: string;
  vendorCode?: string;
  specs?: Record<string, string>;
  images?: string[];
  notes?: string;
  applicability?: string;
  prevPrice?: number;
  prevStock?: number;
  priceDelta?: number;
  stockDelta?: number;
  changedAt?: string;
  pairSide?: "L" | "R";
  pairSku?: string;
  updatedAt: string;
  source: SupplierSource;
}

export interface SyncLog {
  id: string;
  supplierId: string;
  at: string;
  status: SyncStatus;
  imported: number;
  error?: string;
  source: SupplierSource;
  fileName?: string;
  label?: string;
  mode?: ImportMode;
}

export interface TelegramChat {
  id: string;
  title: string;
  username?: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  inn: string;
  discountPercent: number;
  bandMarkups?: Record<string, number>;
  notes: string;
  createdAt: string;
  telegramChatId?: string;
  car?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
}

export interface OrderLine {
  id: string;
  offerId: string;
  supplierId: string;
  sku: string;
  brand: string;
  name: string;
  oem: string;
  qty: number;
  buyPrice: number;
  currency: string;
  deliveryDays: number;
  warehouse: string;
  guid?: string;
  stockId?: string;
  vendorCode?: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  clientId: string;
  markupPercent: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  externalIds?: string[];
  externalStatus?: string;
  externalMessage?: string;
  car?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
  paidAmount?: number;
}

export interface PriceBand {
  id: string;
  min: number;
  max: number | null;
  markupPercent: number;
}

export interface AppSettings {
  telegramToken: string;
  telegramUsername: string;
  telegramPolling: boolean;
  telegramOffset: number;
  telegramSecret: string;
  markupPercent: number;
  moscowHubNote: string;
  priceBands: PriceBand[];
  sellerTitle: string;
  sellerAddress: string;
  vatPercent: number;
  telegramNotifyChatId: string;
  telegramChats: TelegramChat[];
}

export interface PublicSettings {
  telegramConfigured: boolean;
  telegramUsername: string;
  telegramPolling: boolean;
  telegramTokenMasked: string;
  markupPercent: number;
  moscowHubNote: string;
  priceBands: PriceBand[];
  sellerTitle: string;
  sellerAddress: string;
  vatPercent: number;
  telegramNotifyChatId: string;
  telegramChats: TelegramChat[];
}

export interface MoneyMovement {
  id: string;
  at: string;
  amount: number;
  method: PaymentMethod;
  direction: MoneyDirection;
  counterparty: string;
  comment: string;
  clientId?: string;
  orderId?: string;
  supplierId?: string;
  supplierBillId?: string;
  createdAt: string;
}

export interface SupplierBill {
  id: string;
  number: string;
  supplierId: string;
  amount: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSnapshot {
  version: number;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
  clients: Client[];
  orders: Order[];
  moneyMovements: MoneyMovement[];
  supplierBills: SupplierBill[];
}

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  total: number;
  warnings?: string[];
}

export const DEFAULT_COLUMN_MAP: ColumnMap = {
  sku: "sku",
  brand: "brand",
  name: "name",
  oem: "oem",
  category: "category",
  price: "price",
  currency: "currency",
  stock: "stock",
  warehouse: "warehouse",
  multiplicity: "multiplicity",
  deliveryDays: "deliveryDays",
};

export const CATEGORIES = [
  "Масла и жидкости",
  "Фильтры",
  "Тормозная система",
  "Подвеска и рулевое",
  "Двигатель",
  "Электрика и зажигание",
  "Охлаждение",
  "Трансмиссия",
  "Кузов и оптика",
  "Расходники",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ImportHistoryItem {
  id: string;
  at: string;
  supplierId: string;
  label: string;
  fileName: string;
  mode: ImportMode;
  imported: number;
  skipped: number;
  snapshotFile?: string;
  warnings?: string[];
  rolledBackFrom?: string;
}
