export type SupplierSource = "api" | "file" | "url" | "paste" | "manual";
export type ImportMode = "replace" | "merge";
export type AuthMode = "bearer" | "header" | "query";
export type AdapterKind = "generic" | "demo" | "rossko";
export type SyncStatus = "ok" | "error";
export type OrderStatus = "draft" | "assembled" | "sent";
export type PaymentMethod = "cash" | "card" | "cashless";
export type MoneyDirection = "income" | "expense";
export type BillPayStatus = "unpaid" | "partial" | "paid";
export type UserRole = "admin" | "organization" | "manager" | "client" | "guest";
export type AccountStatus = "pending_email" | "pending_key" | "active" | "blocked";
export type PriceView = "clean" | "retail" | "cost";
export type KeyStatus = "pending" | "active" | "revoked";
export type SupplierOwnerRole = "admin" | "organization";
export type ScheduleMark = "work" | "vacation" | "sick" | "timeoff" | "absent";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  clientId?: string;
  organizationId?: string;
  issuedByUserId?: string;
  seeCost?: boolean;
  avatarUrl?: string;
  phone?: string;
  fio?: string;
  carMake?: string;
  carModel?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
  priceView?: PriceView;
}

export interface ActivityEvent {
  id: string;
  at: string;
  userId?: string;
  email?: string;
  role?: UserRole;
  clientId?: string;
  organizationId?: string;
  issuedByUserId?: string;
  action: string;
  detail: string;
  path?: string;
  sku?: string;
  brand?: string;
  offerId?: string;
  orderId?: string;
  buyPrice?: number;
  sellPrice?: number;
  stock?: number;
  deliveryDays?: number;
}

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
  ownerRole?: SupplierOwnerRole;
  ownerId?: string;
  lockedByAdmin?: boolean;
  sharedWithOrgIds?: string[];
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
  sellPrice?: number;
  costPrice?: number;
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

export interface Organization {
  id: string;
  name: string;
  inn: string;
  phone: string;
  email?: string;
  notes: string;
  createdAt: string;
  createdByUserId: string;
  discountPercent: number;
  markupPercent?: number;
  bandMarkups?: Record<string, number>;
  priceBands?: PriceBand[];
  maxMarkup?: number;
  accessKey?: string;
  accountStatus?: AccountStatus;
  priceView?: PriceView;
  managersCanEditSuppliers?: boolean;
}

export interface AccessKeyRecord {
  id: string;
  key: string;
  role: UserRole;
  status: KeyStatus;
  issuedByUserId: string;
  issuedByRole: UserRole;
  organizationId?: string;
  userId?: string;
  clientId?: string;
  requestedByUserId?: string;
  requestedByEmail?: string;
  createdAt: string;
  revokedAt?: string;
  revokedByUserId?: string;
  incomePercent?: number;
  incomeFixed?: number;
  shiftRate?: number;
}

export interface ManagerMembership {
  id: string;
  userId: string;
  organizationId: string;
  incomePercent: number;
  incomeFixed: number;
  shiftRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleDay {
  date: string;
  userId: string;
  organizationId: string;
  mark: ScheduleMark;
  note?: string;
}

export interface ScheduleArchive {
  id: string;
  organizationId: string;
  year: number;
  days: ScheduleDay[];
  archivedAt: string;
}

export interface Client {
  id: string;
  name: string;
  fio?: string;
  phone: string;
  inn: string;
  email?: string;
  discountPercent: number;
  markupPercent?: number;
  bandMarkups?: Record<string, number>;
  accessKey?: string;
  accountStatus?: AccountStatus;
  priceView?: PriceView;
  notes: string;
  createdAt: string;
  telegramChatId?: string;
  car?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
  carMake?: string;
  carModel?: string;
  ownerUserId?: string;
  organizationId?: string;
  issuedByUserId?: string;
  maxMarkup?: number;
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
  snapshotSell?: number;
  snapshotStock?: number;
  snapshotAt?: string;
  fulfillFrom?: "supplier" | "own";
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
  createdByUserId?: string;
  organizationId?: string;
  postedAt?: string;
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
  guestPriceBands: PriceBand[];
  managerPriceBands: PriceBand[];
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
  guestPriceBands: PriceBand[];
  managerPriceBands: PriceBand[];
  sellerTitle: string;
  sellerAddress: string;
  vatPercent: number;
  telegramNotifyChatId: string;
  telegramChats: TelegramChat[];
  organizationPriceBands?: PriceBand[];
  maxMarkup?: number | null;
  showAdminPricing?: boolean;
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
  organizationId?: string;
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

export type PurchaseStatus = "draft" | "posted";
export type WarehouseDocKind = "in" | "out";
export type FulfillFrom = "supplier" | "own";

export interface PurchaseLine {
  id: string;
  sku: string;
  brand: string;
  name: string;
  qty: number;
  warehouse: string;
  buyPrice?: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  status: PurchaseStatus;
  supplierId: string;
  organizationId?: string;
  ownerUserId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  lines: PurchaseLine[];
}

export interface WarehouseLot {
  id: string;
  sku: string;
  brand: string;
  name: string;
  qty: number;
  warehouse: string;
  organizationId?: string;
}

export interface WarehouseDocLine {
  sku: string;
  brand: string;
  qty: number;
  warehouse: string;
}

export interface WarehouseDoc {
  id: string;
  kind: WarehouseDocKind;
  number: string;
  at: string;
  party: string;
  supplierId?: string;
  clientId?: string;
  orderId?: string;
  purchaseId?: string;
  organizationId?: string;
  createdByUserId: string;
  lines: WarehouseDocLine[];
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
  organizations: Organization[];
  purchases: PurchaseOrder[];
  warehouseLots: WarehouseLot[];
  warehouseDocs: WarehouseDoc[];
  managerMemberships: ManagerMembership[];
  scheduleDays: ScheduleDay[];
  scheduleArchives: ScheduleArchive[];
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
