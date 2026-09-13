export const STORE_VERSION = 2;

export const DEMO_KEYS = {
  rossko: "rk_live_demo_rossko_91f2",
  autopiter: "ap_sandbox_7c4e21",
  exist: "ex-feed-demo-4401",
} as const;

export const FIELD_LABELS: Record<string, string> = {
  sku: "Артикул",
  brand: "Бренд",
  name: "Наименование",
  oem: "OEM / оригинал",
  category: "Категория",
  price: "Цена",
  currency: "Валюта",
  stock: "Остаток",
  warehouse: "Склад",
  multiplicity: "Кратность",
  deliveryDays: "Срок до Москвы, дн.",
};

export const AUTH_MODE_LABELS = {
  bearer: "Bearer-токен",
  header: "Заголовок",
  query: "Параметр URL",
} as const;
