export type SupplierSource = "api" | "file";
export type AuthMode = "bearer" | "header" | "query";
export type AdapterKind = "generic" | "demo";
export type SyncStatus = "ok" | "error";

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
  authMode: AuthMode;
  authHeaderName: string;
  authQueryParam: string;
  itemsPath: string;
  columnMap: ColumnMap;
  notes: string;
  active: boolean;
  createdAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  lastSyncError?: string;
  lastSyncCount?: number;
}

export interface Offer {
  id: string;
  supplierId: string;
  sku: string;
  brand: string;
  name: string;
  oem: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  warehouse: string;
  multiplicity: number;
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
}

export interface StoreSnapshot {
  version: number;
  suppliers: Supplier[];
  offers: Offer[];
  logs: SyncLog[];
}

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  total: number;
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
